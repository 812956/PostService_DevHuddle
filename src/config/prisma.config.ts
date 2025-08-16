// import { PrismaClient } from '../../generated/prisma-client'
// import { withAccelerate } from '@prisma/extension-accelerate'

// export const prisma = new PrismaClient().$extends(withAccelerate())


// lib/prisma.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


export default prisma;