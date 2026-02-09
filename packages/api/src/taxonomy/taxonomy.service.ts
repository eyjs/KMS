import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { DomainMasterEntity } from '@kms/shared'

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

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

  async validateDomain(code: string) {
    const domain = await this.prisma.domainMaster.findUnique({
      where: { code },
    })
    if (!domain || !domain.isActive) {
      throw new BadRequestException(`유효하지 않은 도메인입니다: ${code}`)
    }
    return domain
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
