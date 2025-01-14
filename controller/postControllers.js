const Post = require("../models/postModel");
const User = require("../models/userModel");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");
const HttpError = require("../models/errorModel");
const { error } = require("console");

// ============================= CREATE A POST
// POST : api/posts
// PROTECTED

const createPost = async (req, res, next) => {
  try {
    let { title, category, description } = req.body;
    if (!title || !category || !description || !req.files) {
      return next(
        new HttpError("Fill in all fields and choose thumbnail", 422)
      );
    }
    const { thumbnail } = req.files;
    // check the file size
    if (thumbnail.size > 2000000) {
      return next(
        new HttpError("Thumbnail too big. File should be less than 2mb. ")
      );
    }
    let fileName = thumbnail.name;
    let splittedFileName = fileName.split(".");
    let newFilename =
      splittedFileName[0] +
      uuid() +
      "." +
      splittedFileName[splittedFileName.length - 1];
    thumbnail.mv(
      path.join(__dirname, "..", "/uploads", newFilename),
      async (err) => {
        if (err) {
          return next(new HttpError(err));
        } else {
          const newPost = await Post.create({
            title,
            category,
            description,
            thumbnail: newFilename,
            creator: req.user.id,
          });
          if (!newPost) {
            return next(new HttpError("Post couldn't be created"), 422);
          }
          // find user and in crease post count by 1
          const currentUser = await User.findById(req.user.id);
          const userPostCount = currentUser.posts + 1;
          await User.findByIdAndUpdate(req.user.id, { posts: userPostCount });

          res.status(201).json(newPost);
        }
      }
    );
  } catch (error) {
    return next(new HttpError(error));
  }
};

// ============================= GET ALL POST
// POST : api/posts/:id
// UNPROTECTED

const getPosts = async (req, res, next) => {
  try {
    const posts = await Post.find().sort({ updatedAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// ============================= GET SINGLEPOST
// POST : api/posts
// UNPROTECTED

const getPost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) {
      return next(new HttpError("Post not found.", 404));
    }
    res.status(200).json(post);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// ============================= GET POSY BY POST CATEGORY
// POST : api/posts/categories/:category
// UNPROTECTED

const getCatPosts = async (req, res, next) => {
  try {
    const { category } = req.params;
    const catPosts = await Post.find({ category }).sort({ createdAt: -1 });
    res.status(200).json(catPosts);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// ============================= GET USER/AUTHOR POST
// POST : api/posts/users/:id
// UNPROTECTED

const getUserPosts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const posts = await Post.find({ creator: id }).sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// ============================= EDIT POST
// PATCH : api/posts/:id
// PROTECTED

const editPost = async (req, res, next) => {
  try {
    let fileName;
    let newFilename;
    let updatedPost;
    const postId = req.params.id;
    let { title, category, description } = req.body;

    if (!title || !category || description.length < 12) {
      return next(
        new HttpError(
          "Fill in all fields. Description must have at least 12 chars!",
          422
        )
      );
    }
    // get old post from database
    const oldPost = await Post.findById(postId);
    if (req.user.id == oldPost.creator) {
      if (!req.files) {
        updatedPost = await Post.findByIdAndUpdate(
          postId,
          { title, category, description },
          { new: true }
        );
      } else {
        // delete old thumbnail from upload
        fs.unlink(
          path.join(__dirname, "..", "uploads", oldPost.thumbnail),
          async (error) => {
            if (error) {
              return next(new HttpError(error));
            }
          }
        );
        // upload new thumbnail
        const { thumbnail } = req.files;
        // check file size
        if (thumbnail.size > 2000000) {
          return next(
            new HttpError("Thumbnail too big. Should be less than 2mb")
          );
        }
        fileName = thumbnail.name;
        let splittedFileName = fileName.split(".");
        newFilename =
          splittedFileName[0] +
          uuid() +
          "." +
          splittedFileName[splittedFileName.length - 1];
        thumbnail.mv(
          path.join(__dirname, "..", "uploads", newFilename),
          async (error) => {
            if (error) {
              return next(new HttpError(error));
            }
          }
        );

        updatedPost = await Post.findByIdAndUpdate(
          postId,
          { title, category, description, thumbnail: newFilename },
          { new: true }
        );
      }
    }

    if (!updatedPost) {
      return next(new HttpError("Couldn't update post.", 400));
    }

    res.status(200).json(updatedPost);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// ============================= DELETE POST
// DELETE : api/posts/users/:id
// PROTECTED

const deletePost = async (req, res, next) => {
  try {
    const postId = req.params.id;
    if (!postId) {
      return next(new HttpError("Post not found", 404));
    }
    const post = await Post.findById(postId);
    const fileName = post.thumbnail;
    if (req.user.id == post.creator) {
      // Delete thumbnail from upload folder
      fs.unlink(
        path.join(__dirname, "..", "uploads", fileName),
        async (error) => {
          if (error) {
            return next(new HttpError(error));
          } else {
            await Post.findByIdAndDelete(postId);
            // find user and decrease post count by 1
            const currentUser = await User.findById(req.user.id);
            const userPostCount = currentUser.posts - 1;
            await User.findByIdAndUpdate(req.user.id, { posts: userPostCount });
            res.status(200).json(`Post ${postId} deleted`);
          }
        }
      );
    } else {
      return next(new HttpError("You are not authorized to delete this post"));
    }
  } catch (error) {}
};

module.exports = {
  createPost,
  getPosts,
  getPost,
  getCatPosts,
  getUserPosts,
  editPost,
  deletePost,
};
