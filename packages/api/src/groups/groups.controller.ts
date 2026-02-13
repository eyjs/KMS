import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { GroupsService } from './groups.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddGroupMemberDto,
  SetFolderAccessDto,
  UpdateUserGroupsDto,
} from './dto/group.dto'

@ApiTags('groups')
@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // ============================================================
  // 권한 그룹 CRUD
  // ============================================================

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '권한 그룹 목록 조회' })
  async findAll() {
    return this.groupsService.findAll()
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '권한 그룹 상세 조회' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.findOne(id)
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: '권한 그룹 생성' })
  async create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto)
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '권한 그룹 수정' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(id, dto)
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '권한 그룹 삭제' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.groupsService.remove(id)
  }

  // ============================================================
  // 그룹 멤버 관리
  // ============================================================

  @Get(':id/members')
  @Roles('ADMIN')
  @ApiOperation({ summary: '그룹 멤버 목록 조회' })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getMembers(id)
  }

  @Post(':id/members')
  @Roles('ADMIN')
  @ApiOperation({ summary: '그룹에 멤버 추가' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(id, dto.userId)
  }

  @Delete(':id/members/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '그룹에서 멤버 제거' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.groupsService.removeMember(id, userId)
  }

  // ============================================================
  // 그룹-폴더 권한 관리
  // ============================================================

  @Get(':id/folders')
  @Roles('ADMIN')
  @ApiOperation({ summary: '그룹 폴더 권한 목록 조회' })
  async getFolderAccess(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getFolderAccess(id)
  }

  @Post(':id/folders')
  @Roles('ADMIN')
  @ApiOperation({ summary: '그룹에 폴더 권한 추가/수정' })
  async setFolderAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetFolderAccessDto,
  ) {
    return this.groupsService.setFolderAccess(id, dto)
  }

  @Delete(':id/folders/:categoryId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '그룹 폴더 권한 삭제' })
  async removeFolderAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    await this.groupsService.removeFolderAccess(id, categoryId)
  }
}
