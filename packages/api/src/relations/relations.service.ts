import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SecurityLevelGuard } from '../auth/guards/security-level.guard'
import { RELATION_META } from '@kms/shared'
import type { RelationType, UserRole, SecurityLevel } from '@kms/shared'

@Injectable()
export class RelationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDocument(documentId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const [asSource, asTarget] = await Promise.all([
      this.prisma.relation.findMany({
        where: { sourceId: documentId },
        include: {
          target: { select: { id: true, fileName: true, domain: true, lifecycle: true, securityLevel: true } },
        },
      }),
      this.prisma.relation.findMany({
        where: { targetId: documentId },
        include: {
          source: { select: { id: true, fileName: true, domain: true, lifecycle: true, securityLevel: true } },
        },
      }),
    ])

    // 사용자 역할로 접근 가능한 관계 문서만 필터
    const filteredSource = asSource.filter((r: { target: { securityLevel: string } }) =>
      SecurityLevelGuard.canAccess(userRole, r.target.securityLevel as SecurityLevel),
    )
    const filteredTarget = asTarget.filter((r: { source: { securityLevel: string } }) =>
      SecurityLevelGuard.canAccess(userRole, r.source.securityLevel as SecurityLevel),
    )

    return { asSource: filteredSource, asTarget: filteredTarget }
  }

  async create(
    sourceId: string,
    targetId: string,
    relationType: RelationType,
    userId: string,
    userRole: UserRole,
  ) {
    if (sourceId === targetId) {
      throw new BadRequestException('자기 참조는 허용되지 않습니다')
    }

    // 두 문서 존재 확인
    const [source, target] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: sourceId, isDeleted: false } }),
      this.prisma.document.findFirst({ where: { id: targetId, isDeleted: false } }),
    ])

    if (!source) throw new NotFoundException('출발 문서를 찾을 수 없습니다')
    if (!target) throw new NotFoundException('대상 문서를 찾을 수 없습니다')

    // 보안 등급 접근 확인
    if (!SecurityLevelGuard.canAccess(userRole, source.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('출발 문서에 대한 접근 권한이 없습니다')
    }
    if (!SecurityLevelGuard.canAccess(userRole, target.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('대상 문서에 대한 접근 권한이 없습니다')
    }

    // scope 검증
    const meta = RELATION_META[relationType]
    if (meta?.scope === 'same_domain' && source.domain !== target.domain) {
      throw new BadRequestException(
        `${relationType} 관계는 같은 도메인 내에서만 가능합니다`,
      )
    }

    // 관계 생성 (순환 참조는 DB 트리거에서 체크)
    const relation = await this.prisma.relation.create({
      data: {
        sourceId,
        targetId,
        relationType,
        createdById: userId,
      },
    })

    // 양방향 관계면 역방향도 생성
    if (meta?.bidirectional && meta.inverse) {
      await this.prisma.relation.upsert({
        where: {
          sourceId_targetId_relationType: {
            sourceId: targetId,
            targetId: sourceId,
            relationType: meta.inverse,
          },
        },
        update: {},
        create: {
          sourceId: targetId,
          targetId: sourceId,
          relationType: meta.inverse,
          createdById: userId,
        },
      })
    }

    // 이력 기록
    await this.prisma.documentHistory.create({
      data: {
        documentId: sourceId,
        action: 'RELATION_ADD',
        changes: { targetId, relationType },
        userId,
      },
    })

    return relation
  }

  async remove(id: string, userId: string) {
    const relation = await this.prisma.relation.findUnique({ where: { id } })
    if (!relation) throw new NotFoundException('관계를 찾을 수 없습니다')

    // 양방향이면 역방향도 삭제
    const meta = RELATION_META[relation.relationType as RelationType]
    if (meta?.bidirectional && meta.inverse) {
      await this.prisma.relation.deleteMany({
        where: {
          sourceId: relation.targetId,
          targetId: relation.sourceId,
          relationType: meta.inverse,
        },
      })
    }

    await this.prisma.relation.delete({ where: { id } })

    await this.prisma.documentHistory.create({
      data: {
        documentId: relation.sourceId,
        action: 'RELATION_REMOVE',
        changes: { targetId: relation.targetId, relationType: relation.relationType },
        userId,
      },
    })

    return { message: '관계가 삭제되었습니다' }
  }
}
