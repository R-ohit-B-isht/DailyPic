// models/NewsItem.js

const mongoose = require('mongoose');

const newsItemSchema = new mongoose.Schema({
  id: Number,
  type: String,
  by: String,
  time: Date,
  text: String,
  dead: Boolean,
  parent: Number,
  poll: Number,
  kids: [Number],
  url: String,
  score: Number,
  title: String,
  parts: [Number],
  descendants: Number,
  deleted: Boolean,
  hackerNewsUrl: String,
  created: Date,
});

const NewsItem = mongoose.model('NewsItem', newsItemSchema);

module.exports = NewsItem;
