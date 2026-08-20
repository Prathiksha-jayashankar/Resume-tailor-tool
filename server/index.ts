import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import resumeTailorRouter from './routes/resume-tailor'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

// Resume Tailor API
app.use('/api/resume-tailor', resumeTailorRouter)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`[server] Resume Tailor Tool running on http://localhost:${PORT}`)
})