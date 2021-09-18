import express from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

import { protect } from '../middleware/authorization'
import { route } from 'express/lib/router'

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
  console.log(req.user)

  res.status(200).json({ user: req.user })
}

const signOut = (req, res) => {
  res.clearCookie('token')
  res.status(200).json({})
}

export { getAuthRoutes }
