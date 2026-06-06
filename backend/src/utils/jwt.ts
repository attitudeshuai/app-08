import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../types';

export function generateToken(payload: JwtPayload, expiresIn: string = config.jwtExpiresIn): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: expiresIn as any });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
