import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
})

const BUCKET = process.env.R2_BUCKET!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

/**
 * Gera uma URL pré-assinada para upload direto do cliente para o R2.
 * O frontend faz PUT nessa URL com o arquivo, sem passar pelo servidor Next.js.
 */
export async function gerarUrlUpload(chave: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: chave,
    ContentType: contentType
  })

  return getSignedUrl(r2, command, { expiresIn: 300 })
}

/**
 * Faz upload de um Buffer diretamente do servidor (usado nas API routes).
 */
export async function uploadBuffer(chave: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: chave,
    Body: body,
    ContentType: contentType
  }))

  return `${PUBLIC_URL}/${chave}`
}

/**
 * Remove um arquivo do R2 pela chave (caminho no bucket).
 */
export async function deletarArquivo(chave: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: chave
  }))
}

/**
 * Extrai a chave (caminho no bucket) a partir da URL pública.
 */
export function extrairChave(urlPublica: string): string {
  return urlPublica.replace(`${PUBLIC_URL}/`, '')
}
