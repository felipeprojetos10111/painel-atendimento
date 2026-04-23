import { SignJWT, jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

export interface TokenPayload {
  id: number
  nome: string
  email: string
  nivel: string
  cliente_id: number | null  // null = super_admin (sem vínculo a cliente)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(await secret())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, await secret())
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}
