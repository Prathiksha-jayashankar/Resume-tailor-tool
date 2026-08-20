import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import resumeTailorRouter from './routes/resume-tailor'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }))
app.use(express.json())

// Resume Tailor API
app.use('/api/resume-tailor', resumeTailorRouter)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Serve static frontend in production
const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[server] Resume Tailor Tool running on http://localhost:${PORT}`)
})