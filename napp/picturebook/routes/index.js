const express = require('express')
const router = express.Router()
const { ensureAuth, ensureGuest } = require('../middleware/auth')
const axios = require('axios');
const path = require('path');
const { response } = require('express');


router.get('/', ensureGuest, (req, res) => {
  // res.json({message: "hello there"})
  try {
    res.render('login', {
    layout: 'login',
    })
  }catch (err) {
    console.error(err)
    res.render('error/500')
  }
})

async function getTodaysImage() {
  let today = new Date();
  let yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  yesterday=yesterday.toISOString().split('T')[0]
  today=today.toISOString().split('T')[0]
  const apiKey = 'EWrEh3u0WEDyM2DyWRp1zb0VoGzH2XMxz1uszjQP'; // replace with your own API key
  let url = `https://api.nasa.gov/planetary/apod?date=${yesterday}&api_key=${apiKey}`
  const udata = await axios.get(url);

  return udata.data;

}

router.get('/dashboard', ensureAuth, async (req, res) => {
  try {
    let imageurl = await getTodaysImage()
    let img, vid;
    const fileExtension = path.extname(imageurl.url);
if (fileExtension === '.jpg' || fileExtension === '.jpeg' || fileExtension === '.png') {
  img=imageurl
} else {
  vid=imageurl
}
    res.render('dashboard', {
      name: req.user.firstName,
      img,
      vid,
    })
console.log(imageurl,img,vid)
  } catch (err) {
    console.error(err)
    res.render('error/500')
  }
})

module.exports = router
