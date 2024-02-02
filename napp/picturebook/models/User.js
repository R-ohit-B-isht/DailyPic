const mongoose = require('mongoose')


const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  googleId: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  image: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  markedAsRead: [
    {
      articleId: String,
      newsItemId: String,
    },
  ],
  deleted: [
    {
      articleId:String,
    },
  ],
})

module.exports = mongoose.model('User', UserSchema)
