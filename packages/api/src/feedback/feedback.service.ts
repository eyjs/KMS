import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFeedbackDto, UpdateFeedbackDto } from './dto/feedback.dto'

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    return this.prisma.feedback.create({
      data: {
        userId,
        category: dto.category,
        title: dto.title,
        content: dto.content,
        pageUrl: dto.pageUrl ?? null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
  }

  async findAll(query?: { status?: string; category?: string }) {
    return this.prisma.feedback.findMany({
      where: {
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.category ? { category: query.category } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByUser(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    if (!feedback) {
      throw new NotFoundException('피드백을 찾을 수 없습니다')
    }
    return feedback
  }

  async update(id: string, dto: UpdateFeedbackDto) {
    const feedback = await this.prisma.feedback.findUnique({ where: { id } })
    if (!feedback) {
      throw new NotFoundException('피드백을 찾을 수 없습니다')
    }
    return this.prisma.feedback.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
  }
}
