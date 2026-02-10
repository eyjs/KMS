import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { Roles } from './decorators/roles.decorator'
import { RolesGuard } from './guards/roles.guard'
import { LoginDto, RefreshTokenDto, CreateUserDto, UpdateUserRoleDto, CreateApiKeyDto } from './dto/auth.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'JWT 토큰 발급' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  @Post('refresh')
  @ApiOperation({ summary: '토큰 갱신' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 목록 (ADMIN만)' })
  async findAllUsers() {
    return this.authService.findAllUsers()
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 생성 (ADMIN만)' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto.email, dto.password, dto.name, dto.role)
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 역할 변경 (ADMIN만)' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.authService.updateUserRole(id, dto.role, req.user.sub)
  }

  @Patch('users/:id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 활성/비활성 토글 (ADMIN만)' })
  async toggleUserActive(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.authService.toggleUserActive(id, req.user.sub)
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'API Key 생성 (ADMIN만)' })
  async createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.authService.createApiKey(
      dto.name,
      dto.role,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    )
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '현재 사용자 정보' })
  async me(@Request() req: { user: { sub: string; email: string; role: string } }) {
    return req.user
  }
}
