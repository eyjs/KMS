import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  DOMAIN_MAX_DEPTH,
  DOMAIN_LEVEL_LABELS,
  DOMAIN_GUIDANCE,
} from '@kms/shared'
import type { DomainMasterEntity } from '@kms/shared'
import { CreateDomainDto, UpdateDomainDto } from './dto/taxonomy.dto'

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Domains
  // ============================================================

  async getDomains(): Promise<DomainMasterEntity[]> {
    const all = await this.prisma.domainMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return this.buildTree(all as DomainMasterEntity[])
  }

  async getDomainsFlat(): Promise<DomainMasterEntity[]> {
    return this.prisma.domainMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }) as unknown as DomainMasterEntity[]
  }

  private buildTree(domains: DomainMasterEntity[]): DomainMasterEntity[] {
    const map = new Map<string, DomainMasterEntity>(
      domains.map((d) => [d.code, { ...d, children: [] }]),
    )
    const roots: DomainMasterEntity[] = []
    for (const d of map.values()) {
      if (d.parentCode && map.has(d.parentCode)) {
        map.get(d.parentCode)!.children!.push(d)
      } else {
        roots.push(d)
      }
    }
    return roots
  }

  async getDomain(code: string) {
    const domain = await this.prisma.domainMaster.findUnique({
      where: { code },
    })
    if (!domain) throw new NotFoundException(`도메인을 찾을 수 없습니다: ${code}`)
    return domain
  }

  /** 지정 도메인 + 모든 하위 도메인 코드를 BFS로 수집 */
  async getDescendantCodes(code: string): Promise<string[]> {
    const all = await this.prisma.domainMaster.findMany({
      where: { isActive: true },
      select: { code: true, parentCode: true },
    })
    const childrenMap = new Map<string, string[]>()
    for (const d of all) {
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
      const children = childrenMap.get(current) ?? []
      for (const child of children) {
        result.push(child)
        queue.push(child)
      }
    }
    return result
  }

  async validateDomain(code: string) {
    const domain = await this.prisma.domainMaster.findUnique({
      where: { code },
    })
    if (!domain || !domain.isActive) {
      throw new BadRequestException(`유효하지 않은 도메인입니다: ${code}`)
    }
    return domain
  }

  /** 도메인 깊이 계산 (루트=0) */
  private async getDomainDepth(code: string): Promise<number> {
    let depth = 0
    const visited = new Set<string>([code])
    let current = await this.prisma.domainMaster.findUnique({
      where: { code },
      select: { parentCode: true },
    })
    while (current?.parentCode) {
      if (visited.has(current.parentCode)) {
        throw new BadRequestException('도메인 계층에 순환 참조가 감지되었습니다')
      }
      visited.add(current.parentCode)
      depth++
      current = await this.prisma.domainMaster.findUnique({
        where: { code: current.parentCode },
        select: { parentCode: true },
      })
    }
    return depth
  }

  /** 도메인 코드 자동 생성 */
  async generateDomainCode(parentCode?: string): Promise<string> {
    if (!parentCode) {
      // 루트: D01, D02, ...
      const last = await this.prisma.domainMaster.findFirst({
        where: { parentCode: null, code: { startsWith: 'D' } },
        orderBy: { code: 'desc' },
        select: { code: true },
      })
      const seq = last?.code ? parseInt(last.code.slice(1), 10) + 1 : 1
      return `D${String(seq).padStart(2, '0')}`
    }
    // 하위: {parentCode}-01, {parentCode}-02, ...
    const prefix = `${parentCode}-`
    const last = await this.prisma.domainMaster.findFirst({
      where: { parentCode, code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    const seq = last?.code
      ? parseInt(last.code.slice(prefix.length), 10) + 1
      : 1
    return `${prefix}${String(seq).padStart(2, '0')}`
  }

  async createDomain(dto: CreateDomainDto) {
    if (dto.parentCode) {
      const parent = await this.prisma.domainMaster.findUnique({
        where: { code: dto.parentCode },
      })
      if (!parent || !parent.isActive) {
        throw new BadRequestException(`부모 도메인을 찾을 수 없습니다: ${dto.parentCode}`)
      }

      // 깊이 검증
      const parentDepth = await this.getDomainDepth(dto.parentCode)
      const newDepth = parentDepth + 1
      if (newDepth >= DOMAIN_MAX_DEPTH) {
        const maxLabel = DOMAIN_LEVEL_LABELS[DOMAIN_MAX_DEPTH - 1] ?? '최하위'
        throw new BadRequestException(
          `도메인은 "${maxLabel}" 단계까지 가능합니다. ${DOMAIN_GUIDANCE.principle}`,
        )
      }
    }

    // 코드 자동 생성 (미제공 시)
    const code = dto.code || await this.generateDomainCode(dto.parentCode)

    try {
      return await this.prisma.domainMaster.create({
        data: {
          code,
          displayName: dto.displayName,
          parentCode: dto.parentCode ?? null,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? 0,
        },
      })
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(`이미 존재하는 도메인 코드입니다: ${code}`)
      }
      throw error
    }
  }

  async updateDomain(code: string, dto: UpdateDomainDto) {
    const domain = await this.prisma.domainMaster.findUnique({
      where: { code },
    })
    if (!domain) {
      throw new NotFoundException(`도메인을 찾을 수 없습니다: ${code}`)
    }

    return this.prisma.domainMaster.update({
      where: { code },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })
  }

  async deleteDomain(code: string): Promise<void> {
    const domain = await this.prisma.domainMaster.findUnique({
      where: { code },
    })
    if (!domain) {
      throw new NotFoundException(`도메인을 찾을 수 없습니다: ${code}`)
    }

    const children = await this.prisma.domainMaster.count({
      where: { parentCode: code, isActive: true },
    })
    if (children > 0) {
      throw new BadRequestException('하위 도메인이 존재합니다. 먼저 삭제하세요.')
    }

    // 배치된 문서가 있으면 삭제 차단
    const placements = await this.prisma.documentPlacement.count({
      where: { domainCode: code },
    })
    if (placements > 0) {
      throw new BadRequestException('해당 도메인에 배치된 문서가 존재합니다. 먼저 배치를 해제하세요.')
    }

    // 도메인 스코프 관계가 있으면 삭제 차단
    const relations = await this.prisma.relation.count({
      where: { domainCode: code },
    })
    if (relations > 0) {
      throw new BadRequestException('해당 도메인에 연결된 관계가 존재합니다. 먼저 관계를 삭제하세요.')
    }

    await this.prisma.domainMaster.update({
      where: { code },
      data: { isActive: false },
    })
  }
}
