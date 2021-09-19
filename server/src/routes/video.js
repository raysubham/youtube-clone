import express from 'express'
import { PrismaClient } from '@prisma/client'
import { getAuthUser, protect } from '../middleware/authorization'

const prisma = new PrismaClient()

function getVideoRoutes() {
  const router = express.Router()

  router.get('/', getRecommendedVideos)
  router.post('/', protect, addVideo)

  router.get('/trending', getTrendingVideos)
  router.get('/search', searchVideos)

  router.get('/:videoId', getAuthUser, getVideo)
  router.delete('/:videoId', protect, deleteVideo)

  router.get('/:videoId/view', getAuthUser, addVideoView)
  router.get('/:videoId/like', protect, likeVideo)
  router.get('/:videoId/dislike', protect, dislikeVideo)
  router.post('/:videoId/comments', protect, addComment)
  router.delete('/:videoId/comments/:commentId', protect, deleteComment)

  return router
}

export const getVideoViews = async (videos) => {
  for (const video of videos) {
    const views = await prisma.view.count({
      where: {
        videoId: {
          equals: video.id,
        },
      },
    })

    video.views = views
  }

  return videos
}

const getRecommendedVideos = async (req, res) => {
  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!videos.length) {
    return res.status(200).json({ videos })
  }

  videos = await getVideoViews(videos)

  res.status(200).json({ videos })
}

const getTrendingVideos = async (req, res) => {
  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!videos.length) {
    return res.status(200).json({ videos })
  }

  videos = await getVideoViews(videos)
  videos.sort((a, b) => b.views - a.views)

  res.status(200).json({ videos })
}

const searchVideos = async (req, res, next) => {
  const query = req.query.query

  if (!query) {
    return next({
      message: 'Please enter a search query',
      statusCode: 400,
    })
  }

  let videos = await prisma.video.findMany({
    include: { user: true },
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
  })

  if (!videos.length) {
    return res.status(200).json({ videos })
  }

  videos = await getVideoViews(videos)

  res.status(200).json({ videos })
}

const addVideo = async (req, res) => {
  const { title, description, url, thumbnail } = req.body

  const video = await prisma.video.create({
    data: {
      title,
      description,
      url,
      thumbnail,
      user: {
        connect: {
          id: req.user.id,
        },
      },
    },
  })

  res.status(200).json({ video })
}

const addComment = async (req, res, next) => {
  const videoId = req.params.videoId

  const video = await prisma.video.findUnique({
    where: {
      id: videoId,
    },
  })

  if (!video) {
    return next({
      message: `No video found with id: ${videoId}`,
      statusCode: 404,
    })
  }

  const comment = await prisma.comment.create({
    data: {
      text: req.body.text,
      user: {
        connect: {
          id: req.user.id,
        },
      },
      video: {
        connect: {
          id: videoId,
        },
      },
    },
  })

  res.status(200).json({ comment })
}

async function deleteComment(req, res) {
  const commentId = req.params.commentId

  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
    },
    select: {
      userId: true,
    },
  })

  if (comment.userId !== req.user.id) {
    return res
      .status(401)
      .send('You are not authorized to delete this comment!')
  }

  await prisma.comment.delete({
    where: {
      id: commentId,
    },
  })

  res.status(200).json({})
}

const addVideoView = async (req, res, next) => {
  const videoId = req.params.videoId

  const video = await prisma.video.findUnique({
    where: {
      id: videoId,
    },
  })

  if (!video) {
    return next({
      message: `No video found with id: ${videoId}`,
      statusCode: 404,
    })
  }

  if (req.user) {
    await prisma.view.create({
      data: {
        video: {
          connect: {
            id: videoId,
          },
        },
        user: {
          connect: {
            id: req.user.id,
          },
        },
      },
    })
  } else {
    await prisma.view.create({
      data: {
        video: {
          connect: {
            id: videoId,
          },
        },
      },
    })
  }

  res.status(200).json({})
}

const likeVideo = async (req, res, next) => {
  const videoId = req.params.videoId

  const video = await prisma.video.findUnique({
    where: {
      id: videoId,
    },
  })

  if (!video) {
    return next({
      message: `No video found with id: ${videoId}`,
      statusCode: 404,
    })
  }

  const isLiked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: videoId,
      },
      like: {
        equals: 1,
      },
    },
  })

  const isDisliked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: videoId,
      },
      like: {
        equals: -1,
      },
    },
  })

  if (isLiked) {
    await prisma.videoLike.delete({
      where: {
        id: isLiked.id,
      },
    })
  } else if (isDisliked) {
    await prisma.videoLike.update({
      where: {
        id: isDisliked.id,
      },
      data: {
        like: 1,
      },
    })
  } else {
    await prisma.videoLike.create({
      data: {
        user: {
          connect: {
            id: req.user.id,
          },
        },
        video: {
          connect: {
            id: videoId,
          },
        },
        like: 1,
      },
    })
  }

  res.status(200).json({})
}

const dislikeVideo = async (req, res, next) => {
  const videoId = req.params.videoId

  const video = await prisma.video.findUnique({
    where: {
      id: videoId,
    },
  })

  if (!video) {
    return next({
      message: `No video found with id: ${videoId}`,
      statusCode: 404,
    })
  }

  const isLiked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: videoId,
      },
      like: {
        equals: 1,
      },
    },
  })

  const isDisliked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: videoId,
      },
      like: {
        equals: -1,
      },
    },
  })

  if (isDisliked) {
    await prisma.videoLike.delete({
      where: {
        id: isDisliked.id,
      },
    })
  } else if (isLiked) {
    await prisma.videoLike.update({
      where: {
        id: isLiked.id,
      },
      data: {
        like: -1,
      },
    })
  } else {
    await prisma.videoLike.create({
      data: {
        user: {
          connect: {
            id: req.user.id,
          },
        },
        video: {
          connect: {
            id: videoId,
          },
        },
        like: -1,
      },
    })
  }

  res.status(200).json({})
}

const getVideo = async (req, res, next) => {
  const videoId = req.params.videoId

  const video = await prisma.video.findUnique({
    where: {
      id: videoId,
    },
    include: {
      user: true,
      comments: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  if (!video) {
    return next({
      message: `No video found with id: ${videoId}`,
      statusCode: 404,
    })
  }

  let isVideoMine = false
  let isLiked = false
  let isDisliked = false
  let isViewed = false
  let isSubscribed = false

  if (req.user) {
    isVideoMine = req.user.id === video.userId

    isLiked = await prisma.videoLike.findFirst({
      where: {
        userId: {
          equals: req.user.id,
        },
        videoId: {
          equals: videoId,
        },
        like: {
          equals: 1,
        },
      },
    })

    isDisliked = await prisma.videoLike.findFirst({
      where: {
        userId: {
          equals: req.user.id,
        },
        videoId: {
          equals: videoId,
        },
        like: {
          equals: -1,
        },
      },
    })

    isViewed = await prisma.view.findFirst({
      where: {
        userId: { equals: req.user.id },
        videoId: { equals: video.id },
      },
    })

    isSubscribed = await prisma.subscription.findFirst({
      where: {
        subscriberId: { equals: req.user.id },
        subscribedToId: { equals: video.userId },
      },
    })
  }

  const likesCount = await prisma.videoLike.count({
    where: {
      AND: { videoId: { equals: videoId }, like: { equals: 1 } },
    },
  })

  const dislikesCount = await prisma.videoLike.count({
    where: {
      AND: { videoId: { equals: videoId }, like: { equals: -1 } },
    },
  })

  const views = await prisma.view.count({
    where: {
      videoId: { equals: video.id },
    },
  })

  const subscibersCount = await prisma.subscription.count({
    where: {
      subscribedToId: { equals: video.userId },
    },
  })

  video.commentsCount = video.comments.length
  video.isLiked = Boolean(isLiked)
  video.isDisliked = Boolean(isDisliked)
  video.views = views
  video.likesCount = likesCount
  video.dislikesCount = dislikesCount
  video.isVideoMine = isVideoMine
  video.isViewed = Boolean(isViewed)
  video.isSubscribed = Boolean(isSubscribed)
  video.subscibersCount = subscibersCount

  res.status(200).json({ video })
}

const deleteVideo = async (req, res) => {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
    select: {
      userId: true,
    },
  })

  if (req.user.id !== video.userId) {
    return res.status(401).send('You are not authorized to delete this video!')
  }

  await prisma.view.deleteMany({
    where: {
      videoId: { equals: req.params.videoId },
    },
  })
  await prisma.videoLike.deleteMany({
    where: {
      videoId: { equals: req.params.videoId },
    },
  })
  await prisma.comment.deleteMany({
    where: {
      videoId: { equals: req.params.videoId },
    },
  })

  await prisma.video.delete({
    where: {
      id: req.params.videoId,
    },
  })

  res.status(200).json({})
}

export { getVideoRoutes }
