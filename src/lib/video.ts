import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { writeFile, readFile, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import os from 'os'
import path from 'path'

// Aponta para o binário bundled do ffmpeg-static
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic)

/**
 * Comprime um buffer de vídeo para MP4 H.264 720p.
 * Retorna o buffer comprimido e sempre usa extensão .mp4.
 */
export async function comprimirVideo(inputBuffer: Buffer<ArrayBuffer>, ext: string): Promise<Buffer<ArrayBuffer>> {
  const tmpDir    = os.tmpdir()
  const inputPath = path.join(tmpDir, `ffin-${randomUUID()}.${ext}`)
  const outputPath = path.join(tmpDir, `ffout-${randomUUID()}.mp4`)

  await writeFile(inputPath, inputBuffer)

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-crf 28',           // qualidade: 18=alta, 28=boa/leve, 35=menor tamanho
        '-preset fast',      // velocidade de encoding
        '-b:a 128k',         // bitrate do áudio
        '-vf scale=-2:min(720\\,ih)',  // max 720p, mantém proporção
        '-movflags +faststart',        // streaming-friendly
        '-pix_fmt yuv420p',            // compatibilidade máxima
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
  })

  const outputBuffer = await readFile(outputPath)

  // Limpa arquivos temporários
  await Promise.allSettled([unlink(inputPath), unlink(outputPath)])

  return outputBuffer
}
