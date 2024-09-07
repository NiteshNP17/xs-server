const mongoose = require("mongoose");

const albumSchema = new mongoose.Schema({
  models: [{ type: mongoose.Schema.Types.ObjectId, ref: "Actor" }],
  name: {
    type: String,
    required: true,
  },
  cover: {
    type: String,
    required: true,
  },
  studio: String,
  galleryCode: {
    type: String,
    required: true,
  },
  domain: { type: String, required: true },
  images: [{ imgCode: String, fileName: String }],
  date: Date,
  slug: String,
});

// Generate the slug from ObjectId before saving
albumSchema.pre("save", function (next) {
  if (this.isNew) {
    this.slug = this._id.toString().substring(4, 9);
  }
  next();
});

const Album = mongoose.model("Album", albumSchema);
module.exports = Album;
