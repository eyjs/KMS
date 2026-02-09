import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional, IsDateString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

const VALID_ROLES = ['EXTERNAL', 'EMPLOYEE', 'TEAM_LEAD', 'EXECUTIVE', 'ADMIN'] as const

export class LoginDto {
  @ApiProperty({ example: 'admin@company.com' })
  @IsEmail({}, { message: '유효한 이메일을 입력하세요' })
  email!: string

  @ApiProperty({ example: 'admin123' })
  @IsNotEmpty({ message: '비밀번호를 입력하세요' })
  @IsString()
  password!: string
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken!: string
}

export class CreateUserDto {
  @ApiProperty({ example: 'user@company.com' })
  @IsEmail({}, { message: '유효한 이메일을 입력하세요' })
  email!: string

  @ApiProperty({ example: 'password123' })
  @IsNotEmpty()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다' })
  password!: string

  @ApiProperty({ example: '홍길동' })
  @IsNotEmpty()
  @IsString()
  name!: string

  @ApiProperty({ enum: VALID_ROLES, example: 'EMPLOYEE' })
  @IsEnum(VALID_ROLES, { message: '유효한 역할이 아닙니다' })
  role!: (typeof VALID_ROLES)[number]
}

export class CreateApiKeyDto {
  @ApiProperty({ example: '외부업체 A' })
  @IsNotEmpty()
  @IsString()
  name!: string

  @ApiProperty({ enum: VALID_ROLES, example: 'EXTERNAL' })
  @IsEnum(VALID_ROLES, { message: '유효한 역할이 아닙니다' })
  role!: (typeof VALID_ROLES)[number]

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
