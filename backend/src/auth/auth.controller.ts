import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService, RegisterDto, LoginDto } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoggerService } from '../libs/logger.service';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class LoginRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  twoFactorToken?: string;
}

export class EnableTwoFactorDto {
  @IsString()
  token: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * 사용자 등록
   * POST /auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: '사용자 등록', 
    description: '새로운 사용자 계정을 생성합니다.' 
  })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({ status: 201, description: '사용자 등록 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  async register(@Body() registerDto: RegisterRequestDto) {
    const result = await this.authService.register(registerDto);

    return {
      success: true,
      message: 'User registered successfully',
      data: result,
    };
  }

  /**
   * 사용자 로그인
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '사용자 로그인', 
    description: '이메일과 비밀번호로 로그인합니다.' 
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async login(@Body() loginDto: LoginRequestDto, @Request() req: any) {
    // IP 주소 기록
    const ip = req.ip || req.connection.remoteAddress;
    
    const result = await this.authService.login(loginDto);

    // 로그인 성공 시 IP 주소 업데이트
    if (result.accessToken && result.user) {
      // TODO: UsersService.updateLastLogin 호출
    }

    return {
      success: true,
      message: result.requiresTwoFactor ? 'Two-factor authentication required' : 'Login successful',
      data: result,
    };
  }

  /**
   * 토큰 갱신
   * POST /auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '토큰 갱신', 
    description: '리프레시 토큰으로 새로운 액세스 토큰을 발급받습니다.' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string' },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({ status: 200, description: '토큰 갱신 성공' })
  @ApiResponse({ status: 401, description: '유효하지 않은 리프레시 토큰' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    const result = await this.authService.refreshAccessToken(refreshToken);

    if (!result) {
      return {
        success: false,
        message: 'Invalid refresh token',
      };
    }

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  /**
   * 로그아웃
   * POST /auth/logout
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '로그아웃', 
    description: '현재 토큰을 무효화하고 로그아웃합니다.' 
  })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  async logout(@Request() req: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await this.authService.logout(req.user.id, token);

    return {
      success: true,
      message: 'Logout successful',
    };
  }

  /**
   * 내 정보 조회
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '내 정보 조회', 
    description: '현재 로그인한 사용자의 정보를 조회합니다.' 
  })
  @ApiResponse({ status: 200, description: '사용자 정보 조회 성공' })
  async getProfile(@Request() req: any) {
    return {
      success: true,
      data: req.user,
    };
  }

  /**
   * 2FA 비밀키 생성
   * POST /auth/2fa/generate
   */
  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '2FA 비밀키 생성', 
    description: '2단계 인증을 위한 비밀키와 QR 코드를 생성합니다.' 
  })
  @ApiResponse({ status: 200, description: '2FA 비밀키 생성 성공' })
  async generateTwoFactorSecret(@Request() req: any) {
    const result = await this.authService.generateTwoFactorSecret(
      req.user.id,
      req.user.email,
    );

    return {
      success: true,
      message: '2FA secret generated successfully',
      data: result,
    };
  }

  /**
   * 2FA 활성화
   * POST /auth/2fa/enable
   */
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '2FA 활성화', 
    description: '2단계 인증을 활성화합니다.' 
  })
  @ApiBody({ type: EnableTwoFactorDto })
  @ApiResponse({ status: 200, description: '2FA 활성화 성공' })
  @ApiResponse({ status: 400, description: '잘못된 2FA 토큰' })
  async enableTwoFactor(@Request() req: any, @Body() enableDto: EnableTwoFactorDto) {
    const result = await this.authService.enableTwoFactor(req.user.id, enableDto.token);

    if (!result) {
      return {
        success: false,
        message: 'Invalid two-factor authentication token',
      };
    }

    return {
      success: true,
      message: 'Two-factor authentication enabled successfully',
    };
  }

  /**
   * 2FA 비활성화
   * POST /auth/2fa/disable
   */
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '2FA 비활성화', 
    description: '2단계 인증을 비활성화합니다.' 
  })
  @ApiBody({ type: EnableTwoFactorDto })
  @ApiResponse({ status: 200, description: '2FA 비활성화 성공' })
  @ApiResponse({ status: 400, description: '잘못된 2FA 토큰' })
  async disableTwoFactor(@Request() req: any, @Body() disableDto: EnableTwoFactorDto) {
    const result = await this.authService.disableTwoFactor(req.user.id, disableDto.token);

    if (!result) {
      return {
        success: false,
        message: 'Invalid two-factor authentication token',
      };
    }

    return {
      success: true,
      message: 'Two-factor authentication disabled successfully',
    };
  }

  /**
   * 비밀번호 재설정 요청
   * POST /auth/forgot-password
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '비밀번호 재설정 요청', 
    description: '비밀번호 재설정을 위한 토큰을 이메일로 전송합니다.' 
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: '재설정 토큰 전송 성공' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const token = await this.authService.generatePasswordResetToken(forgotPasswordDto.email);

    if (!token) {
      // 보안상 이유로 사용자 존재 여부를 알려주지 않음
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // TODO: 이메일 전송 서비스 연동
    this.loggerService.log(
      `Password reset token generated for: ${forgotPasswordDto.email}`,
      'AuthController',
    );

    return {
      success: true,
      message: 'Password reset link has been sent to your email',
      // 개발 환경에서만 토큰 반환 (실제 운영에서는 제거)
      ...(process.env.NODE_ENV === 'development' && { token }),
    };
  }

  /**
   * 비밀번호 재설정
   * POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '비밀번호 재설정', 
    description: '토큰을 사용하여 새로운 비밀번호로 변경합니다.' 
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: '비밀번호 재설정 성공' })
  @ApiResponse({ status: 400, description: '유효하지 않은 토큰' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );

    if (!result) {
      return {
        success: false,
        message: 'Invalid or expired reset token',
      };
    }

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  }

  /**
   * 2FA 토큰 검증 (로그인 시 사용)
   * POST /auth/2fa/verify
   */
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '2FA 토큰 검증', 
    description: '2단계 인증 토큰을 검증합니다.' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
        twoFactorToken: { type: 'string' },
      },
      required: ['email', 'password', 'twoFactorToken'],
    },
  })
  @ApiResponse({ status: 200, description: '2FA 검증 성공' })
  @ApiResponse({ status: 401, description: '2FA 검증 실패' })
  async verifyTwoFactor(@Body() verifyDto: LoginRequestDto) {
    const result = await this.authService.login(verifyDto);

    return {
      success: true,
      message: 'Two-factor authentication successful',
      data: result,
    };
  }
} 