const express = require("express");
const router = express.Router();
const { ensureAuth, ensureGuest } = require("../middleware/auth");
const axios = require("axios");
const cron = require('node-cron');
const NewsItem = require('../models/NewsItem');
const path = require("path");
const { response } = require("express");

router.get("/", ensureGuest, (req, res) => {
  // res.json({message: "hello there"})
  try {
    res.render("login", {
      layout: "login",
    });
  } catch (err) {
    console.error(err);
    res.render("error/500");
  }
});

async function fetchCommentsRecursive(commentIds) {
  const comments = await Promise.all(
    commentIds.map(async (commentId) => {
      const commentResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${commentId}.json?print=pretty`);
      const comment = {
        id: commentResponse.data.id,
        by: commentResponse.data.by,
        text: commentResponse.data.text,
        time: new Date(commentResponse.data.time * 1000),
      };

      if (commentResponse.data.kids && commentResponse.data.kids.length > 0) {
        // Recursively fetch nested comments
        comment.kids = await fetchCommentsRecursive(commentResponse.data.kids);
      }

      return comment;
    })
  );

  return comments;
}



async function updateNewsItems() {
  try {
    const response = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');
    const topStoryIds = response.data.slice(0, 90);

    const detailedNewsItems = await Promise.all(
      topStoryIds.map(async (id) => {
        const itemResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json?print=pretty`);
        return {
          ...itemResponse.data,
          hackerNewsUrl: `https://news.ycombinator.com/item?id=${id}`,
        };
      })
    );

    // Update existing records or insert new ones
    await Promise.all(
      detailedNewsItems.map(async (item) => {
        await NewsItem.findOneAndUpdate(
          { id: item.id },
          { $set: item },
          { upsert: true, new: true }
        );
      })
    );

    console.log('News items updated in the database.');
  } catch (error) {
    console.error('Error updating news items:', error);
  }
}

// Schedule the news update every 10 seconds using cron
cron.schedule('*/10 * * * * *', () => {
  updateNewsItems();
});

const ITEMS_PER_PAGE = 9;

router.get('/dashboard',ensureAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * ITEMS_PER_PAGE;

    const totalItems = await NewsItem.countDocuments({});
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const newsItems = await NewsItem.find()
      .sort({ postedOn: -1 })
      .skip(skip)
      .limit(ITEMS_PER_PAGE);

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push({
        number: i,
        active: i === page,
      });
    }

    res.render('dashboard', {
      newsItems,
      currentPage: page,
      pages,
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
});

router.get('/news/:id',ensureAuth, async (req, res) => {
  try {
    const newsItemId = req.params.id;
    const newsItem = await NewsItem.findOne({ id: newsItemId });
    let comments = [];
    if (newsItem.kids) {
      comments = await fetchCommentsRecursive(newsItem.kids);
    }
    res.render('newsDetails', {
      newsItem,
      comments,
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
});

// Update your route handling code

// Add a new route to handle marking an article as read
router.post('/markAsRead/:articleId',ensureAuth, async (req, res) => {
  const { articleId } = req.params;
  const { newsItemId } = req.body;

  try {
    // Update the user's document to mark the article as read
    await User.updateOne(
      { _id: req.user._id },
      { $push: { markedAsRead: { articleId, newsItemId } } }
    );

    res.status(200).send('Marked as read');
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = router;
