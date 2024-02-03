const express = require("express");
const router = express.Router();
const { ensureAuth, ensureGuest } = require("../middleware/auth");
const axios = require("axios");
const cron = require('node-cron');
const NewsItem = require('../models/NewsItem');
const User = require('../models/User');
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

    // Fetch all news items, including deleted ones
    const allNewsItems = await NewsItem.find()
      .sort({ postedOn: -1 })
      .skip(skip)
      .limit(ITEMS_PER_PAGE);
    // const nonDeletedNewsItems = allNewsItems
    // Filter out deleted items
    const nonDeletedNewsItems = allNewsItems.filter((item) => {
      const isDeleted = req.user.deleted.some((deletedItem) => deletedItem.articleId.toString() === item._id.toString());
      return !isDeleted;
    });

    // Extract markedAsRead item IDs
    // const markedAsReadItemIds=[]
    const markedAsReadItemIds = req.user.markedAsRead.map((item) => item.newsItemId);

    const currentPage = page;

    const visiblePages = [];
    const totalPagesGreaterThan5 = totalPages > 5;

    if (totalPagesGreaterThan5) {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          visiblePages.push({
            number: i,
            active: i === currentPage,
          });
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) {
          visiblePages.push({
            number: i,
            active: i === currentPage,
          });
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          visiblePages.push({
            number: i,
            active: i === currentPage,
          });
        }
      }
    } else {
      for (let i = 1; i <= totalPages; i++) {
        visiblePages.push({
          number: i,
          active: i === currentPage,
        });
      }
    }
    const showFirst = currentPage > 3;
    const showLast = currentPage < totalPages - 2;
    
    res.render('dashboard', {
      newsItems: nonDeletedNewsItems.map((item) => ({
        ...item.toObject(),
        markedAsRead: markedAsReadItemIds.includes(item.id),
      })),
      currentPage,
      totalPages,
      totalPagesGreaterThan5,
      visiblePages,
      showFirst,
      showLast,
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

router.post('/deleteItem/:articleId', ensureAuth, async (req, res) => {
  const { articleId } = req.params;

  try {
    // Check if the articleId exists in the NewsItem collection
    const newsItem = await NewsItem.findById(articleId);
    
    if (!newsItem) {
      return res.status(404).json({ error: 'News item not found' });
    }

    // Check if the user already marked this item as deleted
    const isAlreadyDeleted = req.user.deleted.some((deletedItem) => deletedItem.articleId.toString() === articleId);

    if (!isAlreadyDeleted) {
      // Add the articleId to the user's deleted array
      req.user.deleted.push({ articleId });
      await req.user.save();

      // Optional: You can also remove the item from markedAsRead if needed
      req.user.markedAsRead = req.user.markedAsRead.filter((readItem) => readItem.newsItemId.toString() !== articleId);
      await req.user.save();

      res.status(200).json({ message: 'Item marked as deleted' });
    } else {
      res.status(400).json({ error: 'Item already marked as deleted' });
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
