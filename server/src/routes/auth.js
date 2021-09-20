import express from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

import { protect } from '../middleware/authorization'

const prisma = new PrismaClient()

function getAuthRoutes() {
  const router = express.Router()

  router.post('/google-login', googleLogin)
  router.get('/me', protect, me)
  router.get('/signout', signOut)

  return router
}

const googleLogin = async (req, res) => {
  const { username, email } = req.body

  let user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        username,
        email,
      },
    })
  }

  const tokenPayload = { id: user.id }
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  })

  res.cookie('token', token, { httpOnly: true })
  res.status(200).send(token)
}

const me = async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      subscriberId: { equals: req.user.id },
    },
  })

  const channelIds = subscriptions.map((sub) => sub.subscribedToId)

  const channels = await prisma.user.findMany({
    where: {
      id: { in: channelIds },
    },
  })

  const user = req.user
  user.channels = channels

  res.status(200).json({ user })
}

const signOut = (req, res) => {
  res.clearCookie('token')
  res.status(200).json({})
}

export { getAuthRoutes }
