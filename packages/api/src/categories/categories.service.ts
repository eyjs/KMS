import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { DomainCategoryEntity } from '@kms/shared'

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDomain(domainCode: string): Promise<DomainCategoryEntity[]> {
    await this.validateDomain(domainCode)

    // 하위 도메인이 있으면 전체(자기+하위) 카테고리를 조회
    const descendantCodes = await this.getDescendantDomainCodes(domainCode)

    const all = await this.prisma.domainCategory.findMany({
      where: { domainCode: { in: descendantCodes } },
      orderBy: { sortOrder: 'asc' },
    })

    return this.buildTree(all)
  }

  /** 해당 도메인 + 모든 하위 도메인 코드를 BFS로 수집 */
  private async getDescendantDomainCodes(code: string): Promise<string[]> {
    const domains = await this.prisma.domainMaster.findMany({
      where: { isActive: true },
      select: { code: true, parentCode: true },
    })
    const childrenMap = new Map<string, string[]>()
    for (const d of domains) {
      if (d.parentCode) {
        const siblings = childrenMap.get(d.parentCode) ?? []
        siblings.push(d.code)
        childrenMap.set(d.parentCode, siblings)
      }
    }
    const result: string[] = [code]
    const queue = [code]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const child of childrenMap.get(current) ?? []) {
        result.push(child)
        queue.push(child)
      }
    }
    return result
  }

  async create(domainCode: string, data: { parentId?: number; name: string; sortOrder?: number }) {
    await this.validateDomain(domainCode)

    if (data.parentId) {
      const parent = await this.prisma.domainCategory.findUnique({
        where: { id: data.parentId },
      })
      if (!parent || parent.domainCode !== domainCode) {
        throw new BadRequestException('부모 카테고리가 해당 도메인에 존재하지 않습니다')
      }
    }

    try {
      return await this.prisma.domainCategory.create({
        data: {
          domainCode,
          parentId: data.parentId ?? null,
          name: data.name,
          sortOrder: data.sortOrder ?? 0,
        },
      })
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('같은 위치에 같은 이름의 카테고리가 이미 존재합니다')
      }
      throw error
    }
  }

  async update(id: number, data: { name?: string; parentId?: number | null; sortOrder?: number }) {
    const category = await this.prisma.domainCategory.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('카테고리를 찾을 수 없습니다')

    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) {
        throw new BadRequestException('자기 자신을 부모로 설정할 수 없습니다')
      }
      const parent = await this.prisma.domainCategory.findUnique({
        where: { id: data.parentId },
      })
      if (!parent || parent.domainCode !== category.domainCode) {
        throw new BadRequestException('부모 카테고리가 해당 도메인에 존재하지 않습니다')
      }
      // 자기 하위를 부모로 설정하는 것 방지
      const descendants = await this.getDescendantIds(id)
      if (descendants.includes(data.parentId)) {
        throw new BadRequestException('하위 카테고리를 부모로 설정할 수 없습니다')
      }
    }

    try {
      return await this.prisma.domainCategory.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.parentId !== undefined && { parentId: data.parentId }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      })
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('같은 위치에 같은 이름의 카테고리가 이미 존재합니다')
      }
      throw error
    }
  }

  async remove(id: number) {
    const category = await this.prisma.domainCategory.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('카테고리를 찾을 수 없습니다')

    // CASCADE로 하위 카테고리도 삭제, 배치는 SET NULL
    await this.prisma.domainCategory.delete({ where: { id } })
    return { message: '카테고리가 삭제되었습니다' }
  }

  async move(id: number, parentId: number | null) {
    return this.update(id, { parentId })
  }

  private async getDescendantIds(id: number): Promise<number[]> {
    const children = await this.prisma.domainCategory.findMany({
      where: { parentId: id },
      select: { id: true },
    })
    const result: number[] = children.map((c) => c.id)
    for (const child of children) {
      const grandChildren = await this.getDescendantIds(child.id)
      result.push(...grandChildren)
    }
    return result
  }

  private buildTree(categories: Array<{
    id: number
    domainCode: string
    parentId: number | null
    name: string
    sortOrder: number
    createdAt: Date
  }>): DomainCategoryEntity[] {
    const map = new Map<number, DomainCategoryEntity>()
    for (const c of categories) {
      map.set(c.id, {
        id: c.id,
        domainCode: c.domainCode,
        parentId: c.parentId,
        name: c.name,
        sortOrder: c.sortOrder,
        children: [],
        createdAt: c.createdAt.toISOString(),
      })
    }
    const roots: DomainCategoryEntity[] = []
    for (const c of map.values()) {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children!.push(c)
      } else {
        roots.push(c)
      }
    }
    return roots
  }

  private async validateDomain(code: string) {
    const domain = await this.prisma.domainMaster.findUnique({ where: { code } })
    if (!domain || !domain.isActive) {
      throw new BadRequestException(`유효하지 않은 도메인입니다: ${code}`)
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    )
  }
}
