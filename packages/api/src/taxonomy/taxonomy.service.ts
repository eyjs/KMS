import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  FACET_DEFAULT_PREFIX,
  DOMAIN_MAX_DEPTH,
  DOMAIN_LEVEL_LABELS,
  DOMAIN_GUIDANCE,
} from '@kms/shared'
import type { DomainMasterEntity } from '@kms/shared'
import { CreateDomainDto, UpdateDomainDto, CreateFacetDto, UpdateFacetDto, CreateFacetTypeDto, UpdateFacetTypeDto } from './dto/taxonomy.dto'

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Facet Type CRUD
  // ============================================================

  async getFacetTypes() {
    return this.prisma.facetTypeMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async getAllFacetTypes() {
    return this.prisma.facetTypeMaster.findMany({
      orderBy: { sortOrder: 'asc' },
    })
  }

  async createFacetType(dto: CreateFacetTypeDto) {
    const existing = await this.prisma.facetTypeMaster.findUnique({
      where: { code: dto.code },
    })
    if (existing) {
      throw new ConflictException(`이미 존재하는 분류 유형 코드입니다: ${dto.code}`)
    }
    return this.prisma.facetTypeMaster.create({
      data: {
        code: dto.code,
        displayName: dto.displayName,
        codePrefix: dto.codePrefix,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    })
  }

  async updateFacetType(code: string, dto: UpdateFacetTypeDto) {
    const facetType = await this.prisma.facetTypeMaster.findUnique({
      where: { code },
    })
    if (!facetType) {
      throw new NotFoundException(`분류 유형을 찾을 수 없습니다: ${code}`)
    }
    return this.prisma.facetTypeMaster.update({
      where: { code },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.codePrefix !== undefined && { codePrefix: dto.codePrefix }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })
  }

  async deleteFacetType(code: string): Promise<void> {
    const facetType = await this.prisma.facetTypeMaster.findUnique({
      where: { code },
    })
    if (!facetType) {
      throw new NotFoundException(`분류 유형을 찾을 수 없습니다: ${code}`)
    }

    // 1) 분류 값이 있으면 거부
    const facetCount = await this.prisma.facetMaster.count({
      where: { facetType: code, isActive: true },
    })
    if (facetCount > 0) {
      throw new BadRequestException(
        `이 분류 유형에 ${facetCount}개의 분류 값이 등록되어 있습니다. 먼저 분류 값을 삭제하세요.`,
      )
    }

    // 2) 도메인 requiredFacets/ssotKey에서 참조 중이면 거부
    const domains = await this.prisma.domainMaster.findMany({
      where: { isActive: true },
      select: { code: true, displayName: true, requiredFacets: true, ssotKey: true },
    })
    const referencingDomains = domains.filter((d) => {
      const rf = (d.requiredFacets as string[]) ?? []
      const sk = (d.ssotKey as string[]) ?? []
      return rf.includes(code) || sk.includes(code)
    })
    if (referencingDomains.length > 0) {
      const names = referencingDomains.map((d) => d.displayName).join(', ')
      throw new BadRequestException(
        `다음 도메인에서 사용 중입니다: ${names}. 도메인 설정에서 먼저 제거하세요.`,
      )
    }

    // 3) 문서 분류에서 사용 중이면 거부
    const classCount = await this.prisma.classification.count({
      where: { facetType: code },
    })
    if (classCount > 0) {
      throw new BadRequestException(
        `${classCount}건의 문서가 이 분류 유형을 사용하고 있습니다. 삭제할 수 없습니다.`,
      )
    }

    await this.prisma.facetTypeMaster.update({
      where: { code },
      data: { isActive: false },
    })
  }

  /** requiredFacets / ssotKey에 유효한 facet type 코드인지 검증 */
  private async validateFacetTypeCodes(codes: string[]): Promise<void> {
    const validTypes = await this.prisma.facetTypeMaster.findMany({
      where: { isActive: true },
      select: { code: true },
    })
    const validSet = new Set(validTypes.map((t) => t.code))
    const invalid = codes.filter((c) => !validSet.has(c))
    if (invalid.length > 0) {
      throw new BadRequestException(`유효하지 않은 분류 유형입니다: ${invalid.join(', ')}`)
    }
  }

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

  async getFacets(facetType: string, domain?: string) {
    return this.prisma.facetMaster.findMany({
      where: {
        facetType,
        isActive: true,
        ...(domain && { OR: [{ domain }, { domain: null }] }),
      },
      orderBy: { sortOrder: 'asc' },
    })
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
    let current = await this.prisma.domainMaster.findUnique({
      where: { code },
      select: { parentCode: true },
    })
    while (current?.parentCode) {
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
    let parentDomain: { requiredFacets: unknown; ssotKey: unknown } | null = null

    // Facet 이름 충돌 검사 — 보험사/상품/문서유형 이름으로 도메인 생성 차단
    const facetCollision = await this.prisma.facetMaster.findFirst({
      where: { displayName: dto.displayName, isActive: true },
    })
    if (facetCollision) {
      throw new BadRequestException(
        `"${dto.displayName}"은(는) 분류(${facetCollision.facetType})에 이미 등록되어 있습니다. ` +
        DOMAIN_GUIDANCE.facetGuide,
      )
    }

    if (dto.parentCode) {
      const parent = await this.prisma.domainMaster.findUnique({
        where: { code: dto.parentCode },
      })
      if (!parent || !parent.isActive) {
        throw new BadRequestException(`부모 도메인을 찾을 수 없습니다: ${dto.parentCode}`)
      }
      parentDomain = parent

      // 깊이 검증
      const parentDepth = await this.getDomainDepth(dto.parentCode)
      const newDepth = parentDepth + 1
      if (newDepth >= DOMAIN_MAX_DEPTH) {
        const maxLabel = DOMAIN_LEVEL_LABELS[DOMAIN_MAX_DEPTH - 1] ?? '최하위'
        throw new BadRequestException(
          `도메인은 "${maxLabel}" 단계까지 가능합니다. ${DOMAIN_GUIDANCE.facetGuide}`,
        )
      }
    }

    // 코드 자동 생성 (별칭 미제공 시)
    const code = dto.code || await this.generateDomainCode(dto.parentCode)

    // requiredFacets 유효성 검증
    if (dto.requiredFacets && dto.requiredFacets.length > 0) {
      await this.validateFacetTypeCodes(dto.requiredFacets)
    }
    if (dto.ssotKey && dto.ssotKey.length > 0) {
      await this.validateFacetTypeCodes(dto.ssotKey)
    }

    // 부모가 있고 requiredFacets/ssotKey가 미제공이면 부모에서 상속
    let requiredFacets = dto.requiredFacets ?? []
    let ssotKey = dto.ssotKey ?? []
    if (parentDomain && requiredFacets.length === 0 && ssotKey.length === 0) {
      requiredFacets = (parentDomain.requiredFacets as string[]) ?? []
      ssotKey = (parentDomain.ssotKey as string[]) ?? []
    }

    try {
      return await this.prisma.domainMaster.create({
        data: {
          code,
          displayName: dto.displayName,
          parentCode: dto.parentCode ?? null,
          description: dto.description ?? null,
          requiredFacets,
          ssotKey,
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

    if (dto.requiredFacets && dto.requiredFacets.length > 0) {
      await this.validateFacetTypeCodes(dto.requiredFacets)
    }
    if (dto.ssotKey && dto.ssotKey.length > 0) {
      await this.validateFacetTypeCodes(dto.ssotKey)
    }

    return this.prisma.domainMaster.update({
      where: { code },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.requiredFacets !== undefined && { requiredFacets: dto.requiredFacets }),
        ...(dto.ssotKey !== undefined && { ssotKey: dto.ssotKey }),
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

    const docs = await this.prisma.document.count({
      where: { domain: code, isDeleted: false },
    })
    if (docs > 0) {
      throw new BadRequestException('해당 도메인에 문서가 존재합니다. 먼저 문서를 이동하거나 삭제하세요.')
    }

    await this.prisma.domainMaster.update({
      where: { code },
      data: { isActive: false },
    })
  }

  /** Facet 코드 자동 생성 — DB에서 codePrefix 조회 */
  async generateFacetCode(facetType: string): Promise<string> {
    const ft = await this.prisma.facetTypeMaster.findUnique({
      where: { code: facetType },
      select: { codePrefix: true },
    })
    const prefix = ft?.codePrefix ?? FACET_DEFAULT_PREFIX
    const last = await this.prisma.facetMaster.findFirst({
      where: { facetType, code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    const seq = last?.code
      ? parseInt(last.code.slice(prefix.length), 10) + 1
      : 1
    return `${prefix}${String(seq).padStart(3, '0')}`
  }

  async createFacet(dto: CreateFacetDto) {
    // 코드 자동 생성 (미제공 시)
    const code = dto.code || await this.generateFacetCode(dto.facetType)

    try {
      return await this.prisma.facetMaster.create({
        data: {
          facetType: dto.facetType,
          code,
          displayName: dto.displayName,
          parentCode: dto.parentCode ?? null,
          domain: dto.domain ?? null,
          tier: dto.tier ?? null,
          maxAgeDays: dto.maxAgeDays ?? null,
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
        throw new ConflictException(`이미 존재하는 분류 코드입니다: ${dto.facetType}/${code}`)
      }
      throw error
    }
  }

  async updateFacet(id: number, dto: UpdateFacetDto) {
    const facet = await this.prisma.facetMaster.findUnique({ where: { id } })
    if (!facet) throw new NotFoundException(`분류를 찾을 수 없습니다: ${id}`)

    return this.prisma.facetMaster.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.parentCode !== undefined && { parentCode: dto.parentCode }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.tier !== undefined && { tier: dto.tier }),
        ...(dto.maxAgeDays !== undefined && { maxAgeDays: dto.maxAgeDays }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })
  }

  async deleteFacet(id: number): Promise<void> {
    const facet = await this.prisma.facetMaster.findUnique({ where: { id } })
    if (!facet) throw new NotFoundException(`분류를 찾을 수 없습니다: ${id}`)

    // 해당 facet을 사용하는 문서가 있는지 확인
    const usageCount = await this.prisma.classification.count({
      where: { facetType: facet.facetType, facetValue: facet.code },
    })
    if (usageCount > 0) {
      throw new BadRequestException(
        `이 분류를 사용하는 문서가 ${usageCount}건 있습니다. 먼저 문서의 분류를 변경하세요.`,
      )
    }

    await this.prisma.facetMaster.update({
      where: { id },
      data: { isActive: false },
    })
  }

  async validateClassifications(domainCode: string, classifications: Record<string, string>) {
    const domain = await this.validateDomain(domainCode)
    const requiredFacets = domain.requiredFacets as string[]

    // 필수 facet 존재 확인
    for (const facet of requiredFacets) {
      if (!classifications[facet]) {
        throw new BadRequestException(`필수 분류가 누락되었습니다: ${facet}`)
      }
    }

    // 초과 필드 방지
    const allowedFacets = new Set(requiredFacets)
    for (const key of Object.keys(classifications)) {
      if (!allowedFacets.has(key)) {
        throw new BadRequestException(`허용되지 않는 분류입니다: ${key}`)
      }
    }

    // 각 facet 값의 유효성 확인
    for (const [facetType, facetValue] of Object.entries(classifications)) {
      const facet = await this.prisma.facetMaster.findFirst({
        where: { facetType, code: facetValue, isActive: true },
      })
      if (!facet) {
        throw new BadRequestException(
          `유효하지 않은 분류 값입니다: ${facetType}=${facetValue}`,
        )
      }
    }
  }
}
