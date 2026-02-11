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
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CategoriesService } from './categories.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateCategoryDto, UpdateCategoryDto, MoveCategoryDto } from './dto/category.dto'

@ApiTags('categories')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('domains/:code/categories')
  @ApiOperation({ summary: '도메인 카테고리 트리 조회' })
  async findByDomain(@Param('code') code: string) {
    return this.categoriesService.findByDomain(code)
  }

  @Post('domains/:code/categories')
  @Roles('EDITOR')
  @ApiOperation({ summary: '카테고리 생성 (작성자 이상)' })
  async create(
    @Param('code') code: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(code, dto)
  }

  @Patch('categories/:id')
  @Roles('EDITOR')
  @ApiOperation({ summary: '카테고리 수정' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto)
  }

  @Delete('categories/:id')
  @Roles('EDITOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '카테고리 삭제 (하위도 CASCADE)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.categoriesService.remove(id)
  }

  @Patch('categories/:id/move')
  @Roles('EDITOR')
  @ApiOperation({ summary: '카테고리 이동 (부모 변경)' })
  async move(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveCategoryDto,
  ) {
    return this.categoriesService.move(id, dto.parentId ?? null)
  }
}
