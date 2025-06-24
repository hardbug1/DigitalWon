import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../libs/logger.service';
import * as nodemailer from 'nodemailer';
import * as twilio from 'twilio';

export interface EmailData {
  to: string;
  subject: string;
  template: string;
  data: any;
}

export interface SmsData {
  to: string;
  message: string;
}

export interface TransactionData {
  id: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  toAddress?: string;
  fromAddress?: string;
  transactionHash?: string;
}

@Injectable()
export class NotificationService {
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: twilio.Twilio;
  private fromEmail: string;
  private fromName: string;
  private twilioPhoneNumber: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.initializeEmailTransporter();
    this.initializeTwilioClient();
    this.fromEmail = this.configService.get('FROM_EMAIL', 'noreply@krwx.com');
    this.fromName = this.configService.get('FROM_NAME', 'KRWX Stablecoin');
    this.twilioPhoneNumber = this.configService.get('TWILIO_PHONE_NUMBER') || '';
  }

  /**
   * 이메일 전송 설정 초기화
   */
  private initializeEmailTransporter(): void {
    const smtpConfig = {
      host: this.configService.get('SMTP_HOST'),
      port: parseInt(this.configService.get('SMTP_PORT', '587')),
      secure: false, // STARTTLS 사용
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    };

    this.emailTransporter = nodemailer.createTransport(smtpConfig);
  }

  /**
   * Twilio 클라이언트 초기화
   */
  private initializeTwilioClient(): void {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    }
  }

  /**
   * 이메일 발송
   * @param emailData 이메일 데이터
   * @returns 발송 성공 여부
   */
  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // 이메일 주소 유효성 검사
      if (!this.isValidEmail(emailData.to)) {
        this.loggerService.error(
          `Invalid email address: ${emailData.to}`,
          '',
          'NotificationService',
        );
        return false;
      }

      // 템플릿 렌더링
      const htmlContent = this.renderTemplate(emailData.template, emailData.data);

      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: htmlContent,
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      this.loggerService.log(
        `Email sent successfully to ${emailData.to} (ID: ${result.messageId})`,
        'NotificationService',
      );

      return true;
    } catch (error) {
      this.loggerService.error(
        `Failed to send email to ${emailData.to}: ${error.message}`,
        error.stack,
        'NotificationService',
      );
      return false;
    }
  }

  /**
   * SMS 발송
   * @param smsData SMS 데이터
   * @returns 발송 성공 여부
   */
  async sendSMS(smsData: SmsData): Promise<boolean> {
    try {
      // 전화번호 유효성 검사
      if (!this.isValidPhoneNumber(smsData.to)) {
        this.loggerService.error(
          `Invalid phone number: ${smsData.to}`,
          '',
          'NotificationService',
        );
        return false;
      }

      if (!this.twilioClient) {
        this.loggerService.error(
          'Twilio client not initialized',
          '',
          'NotificationService',
        );
        return false;
      }

      const message = await this.twilioClient.messages.create({
        body: smsData.message,
        from: this.twilioPhoneNumber,
        to: smsData.to,
      });

      this.loggerService.log(
        `SMS sent successfully to ${smsData.to} (SID: ${message.sid})`,
        'NotificationService',
      );

      return true;
    } catch (error) {
      this.loggerService.error(
        `Failed to send SMS to ${smsData.to}: ${error.message}`,
        error.stack,
        'NotificationService',
      );
      return false;
    }
  }

  /**
   * 환영 이메일 발송
   * @param email 이메일 주소
   * @param name 사용자 이름
   * @returns 발송 성공 여부
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'KRWX 스테이블코인에 오신 것을 환영합니다!',
      template: 'welcome',
      data: {
        name,
        loginUrl: `${this.configService.get('FRONTEND_URL', 'https://krwx.com')}/login`,
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@krwx.com'),
      },
    });
  }

  /**
   * 이메일 인증 메일 발송
   * @param email 이메일 주소
   * @param name 사용자 이름
   * @param token 인증 토큰
   * @returns 발송 성공 여부
   */
  async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL', 'https://krwx.com')}/verify-email?token=${token}`;

    return this.sendEmail({
      to: email,
      subject: '[KRWX] 이메일 인증이 필요합니다',
      template: 'email-verification',
      data: {
        name,
        verificationUrl,
        expirationTime: '24시간',
      },
    });
  }

  /**
   * 비밀번호 재설정 이메일 발송
   * @param email 이메일 주소
   * @param name 사용자 이름
   * @param token 재설정 토큰
   * @returns 발송 성공 여부
   */
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'https://krwx.com')}/reset-password?token=${token}`;

    return this.sendEmail({
      to: email,
      subject: '[KRWX] 비밀번호 재설정 요청',
      template: 'password-reset',
      data: {
        name,
        resetUrl,
        expirationTime: '1시간',
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@krwx.com'),
      },
    });
  }

  /**
   * 2FA 인증 코드 SMS 발송
   * @param phoneNumber 전화번호
   * @param code 인증 코드
   * @returns 발송 성공 여부
   */
  async sendTwoFactorSMS(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[KRWX] 인증 코드: ${code}\n\n이 코드는 5분 후 만료됩니다. 타인에게 절대 알려주지 마세요.`;

    return this.sendSMS({
      to: phoneNumber,
      message,
    });
  }

  /**
   * 거래 알림 이메일 발송
   * @param email 이메일 주소
   * @param name 사용자 이름
   * @param transaction 거래 정보
   * @returns 발송 성공 여부
   */
  async sendTransactionNotification(
    email: string,
    name: string,
    transaction: TransactionData,
  ): Promise<boolean> {
    const subjectMap = {
      SEND: '송금 완료',
      RECEIVE: '입금 확인',
      DEPOSIT: '입금 완료',
      WITHDRAWAL: '출금 완료',
    };

    const subject = `[KRWX] ${subjectMap[transaction.type] || '거래'} 알림`;

    return this.sendEmail({
      to: email,
      subject,
      template: 'transaction-notification',
      data: {
        name,
        transaction,
        explorerUrl: transaction.transactionHash
          ? `${this.configService.get('BLOCKCHAIN_EXPLORER_URL')}/tx/${transaction.transactionHash}`
          : null,
      },
    });
  }

  /**
   * KYC 상태 변경 알림 발송
   * @param email 이메일 주소
   * @param name 사용자 이름
   * @param status KYC 상태
   * @param reason 거부 사유 (선택)
   * @returns 발송 성공 여부
   */
  async sendKycStatusNotification(
    email: string,
    name: string,
    status: string,
    reason?: string,
  ): Promise<boolean> {
    const statusMap = {
      APPROVED: 'KYC 인증 완료',
      REJECTED: 'KYC 인증 거부',
      PENDING: 'KYC 심사 중',
    };

    const subject = `[KRWX] ${statusMap[status] || 'KYC 상태 변경'} 알림`;

    return this.sendEmail({
      to: email,
      subject,
      template: 'kyc-status',
      data: {
        name,
        status,
        reason,
        dashboardUrl: `${this.configService.get('FRONTEND_URL', 'https://krwx.com')}/dashboard`,
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@krwx.com'),
      },
    });
  }

  /**
   * 보안 알림 발송
   * @param email 이메일 주소
   * @param name 사용자 이름
   * @param alertType 알림 유형
   * @param details 상세 정보
   * @returns 발송 성공 여부
   */
  async sendSecurityAlert(
    email: string,
    name: string,
    alertType: string,
    details: any,
  ): Promise<boolean> {
    const alertMap = {
      SUSPICIOUS_LOGIN: '의심스러운 로그인 시도',
      PASSWORD_CHANGED: '비밀번호 변경',
      TWO_FACTOR_ENABLED: '2단계 인증 활성화',
      TWO_FACTOR_DISABLED: '2단계 인증 비활성화',
      ACCOUNT_LOCKED: '계정 잠금',
    };

    const subject = `[KRWX] 보안 알림: ${alertMap[alertType] || '보안 이벤트'}`;

    return this.sendEmail({
      to: email,
      subject,
      template: 'security-alert',
      data: {
        name,
        alertType,
        details,
        timestamp: new Date().toLocaleString('ko-KR'),
        securityUrl: `${this.configService.get('FRONTEND_URL', 'https://krwx.com')}/security`,
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@krwx.com'),
      },
    });
  }

  /**
   * 이메일 템플릿 렌더링
   * @param templateName 템플릿 이름
   * @param data 템플릿 데이터
   * @returns 렌더링된 HTML
   */
  renderTemplate(templateName: string, data: any): string {
    const templates = {
      welcome: this.getWelcomeTemplate(data),
      'email-verification': this.getEmailVerificationTemplate(data),
      'password-reset': this.getPasswordResetTemplate(data),
      'transaction-notification': this.getTransactionNotificationTemplate(data),
      'kyc-status': this.getKycStatusTemplate(data),
      'security-alert': this.getSecurityAlertTemplate(data),
    };

    return templates[templateName] || this.getDefaultTemplate(data);
  }

  /**
   * 이메일 주소 유효성 검사
   * @param email 이메일 주소
   * @returns 유효성 여부
   */
  isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 전화번호 유효성 검사
   * @param phoneNumber 전화번호
   * @returns 유효성 여부
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') return false;
    // 국제 전화번호 형식 (+로 시작)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  // === 이메일 템플릿들 ===

  private getWelcomeTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KRWX에 오신 것을 환영합니다</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; background: #f8f9fa; padding: 20px; border-radius: 8px; }
          .content { padding: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>KRWX 스테이블코인에 오신 것을 환영합니다!</h1>
          </div>
          <div class="content">
            <p>안녕하세요 ${data.name}님,</p>
            <p>KRWX 스테이블코인 플랫폼에 가입해 주셔서 감사합니다. 이제 안전하고 편리한 한국 원화 기반 디지털 화폐 서비스를 이용하실 수 있습니다.</p>
            
            <h3>주요 기능:</h3>
            <ul>
              <li>원화 1:1 페깅 스테이블코인 발행/소각</li>
              <li>빠르고 안전한 P2P 송금</li>
              <li>다양한 DeFi 서비스 연동</li>
              <li>실시간 거래 내역 및 포트폴리오 관리</li>
            </ul>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl}" class="button">지금 시작하기</a>
            </p>
            
            <p>문의사항이 있으시면 언제든지 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>로 연락해 주세요.</p>
            
            <p>감사합니다.<br>KRWX 팀 드림</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getEmailVerificationTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>이메일 인증</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>이메일 인증이 필요합니다</h2>
          
          <p>안녕하세요 ${data.name}님,</p>
          <p>KRWX 계정의 이메일 인증을 완료하기 위해 아래 버튼을 클릭해 주세요.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationUrl}" class="button">이메일 인증하기</a>
          </p>
          
          <div class="warning">
            <strong>중요:</strong> 이 링크는 ${data.expirationTime} 후 만료됩니다.
          </div>
          
          <p>버튼이 작동하지 않으면 다음 링크를 복사하여 브라우저에 붙여넣기 하세요:</p>
          <p style="word-break: break-all; color: #007bff;">${data.verificationUrl}</p>
          
          <p>이 이메일을 요청하지 않으셨다면 무시하셔도 됩니다.</p>
          
          <p>감사합니다.<br>KRWX 팀 드림</p>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>비밀번호 재설정</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>비밀번호 재설정 요청</h2>
          
          <p>안녕하세요 ${data.name}님,</p>
          <p>KRWX 계정의 비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해 주세요.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" class="button">비밀번호 재설정</a>
          </p>
          
          <div class="warning">
            <strong>보안 알림:</strong> 이 링크는 ${data.expirationTime} 후 만료됩니다. 본인이 요청하지 않았다면 즉시 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>로 연락해 주세요.
          </div>
          
          <p>버튼이 작동하지 않으면 다음 링크를 복사하여 브라우저에 붙여넣기 하세요:</p>
          <p style="word-break: break-all; color: #007bff;">${data.resetUrl}</p>
          
          <p>감사합니다.<br>KRWX 팀 드림</p>
        </div>
      </body>
      </html>
    `;
  }

  private getTransactionNotificationTemplate(data: any): string {
    const { transaction } = data;
    const typeMap = {
      SEND: '송금',
      RECEIVE: '입금',
      DEPOSIT: '입금',
      WITHDRAWAL: '출금',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>거래 알림</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .transaction-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .status-completed { color: #28a745; font-weight: bold; }
          .status-pending { color: #ffc107; font-weight: bold; }
          .status-failed { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>거래 알림</h2>
          
          <p>안녕하세요 ${data.name}님,</p>
          <p>${typeMap[transaction.type] || '거래'}가 처리되었습니다.</p>
          
          <div class="transaction-info">
            <h3>거래 정보</h3>
            <p><strong>거래 유형:</strong> ${typeMap[transaction.type] || transaction.type}</p>
            <p><strong>금액:</strong> ${transaction.amount} ${transaction.currency}</p>
            <p><strong>상태:</strong> <span class="status-${transaction.status.toLowerCase()}">${transaction.status}</span></p>
            <p><strong>거래 ID:</strong> ${transaction.id}</p>
            ${transaction.toAddress ? `<p><strong>받는 주소:</strong> ${transaction.toAddress}</p>` : ''}
            ${transaction.fromAddress ? `<p><strong>보내는 주소:</strong> ${transaction.fromAddress}</p>` : ''}
          </div>
          
          ${data.explorerUrl ? `<p><a href="${data.explorerUrl}" style="color: #007bff;">블록체인 탐색기에서 확인</a></p>` : ''}
          
          <p>감사합니다.<br>KRWX 팀 드림</p>
        </div>
      </body>
      </html>
    `;
  }

  private getKycStatusTemplate(data: any): string {
    const statusMessages = {
      APPROVED: '축하합니다! KYC 인증이 완료되었습니다.',
      REJECTED: 'KYC 인증이 거부되었습니다.',
      PENDING: 'KYC 심사가 진행 중입니다.',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KYC 상태 알림</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .status-box { padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .status-approved { background: #d4edda; border: 1px solid #c3e6cb; }
          .status-rejected { background: #f8d7da; border: 1px solid #f5c6cb; }
          .status-pending { background: #fff3cd; border: 1px solid #ffeaa7; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>KYC 상태 알림</h2>
          
          <p>안녕하세요 ${data.name}님,</p>
          
          <div class="status-box status-${data.status.toLowerCase()}">
            <h3>${statusMessages[data.status] || 'KYC 상태가 변경되었습니다.'}</h3>
            ${data.reason ? `<p><strong>사유:</strong> ${data.reason}</p>` : ''}
          </div>
          
          ${data.status === 'APPROVED' ? 
            '<p>이제 모든 KRWX 서비스를 제한 없이 이용하실 수 있습니다.</p>' :
            data.status === 'REJECTED' ?
            '<p>추가 문의사항은 고객지원팀으로 연락해 주세요.</p>' :
            '<p>심사 완료까지 1-3일 정도 소요될 수 있습니다.</p>'
          }
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" class="button">대시보드 확인</a>
          </p>
          
          <p>문의사항이 있으시면 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>로 연락해 주세요.</p>
          
          <p>감사합니다.<br>KRWX 팀 드림</p>
        </div>
      </body>
      </html>
    `;
  }

  private getSecurityAlertTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>보안 알림</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>🔐 보안 알림</h2>
          
          <p>안녕하세요 ${data.name}님,</p>
          
          <div class="alert-box">
            <h3>보안 이벤트가 감지되었습니다</h3>
            <p><strong>알림 유형:</strong> ${data.alertType}</p>
            <p><strong>발생 시간:</strong> ${data.timestamp}</p>
          </div>
          
          ${data.details ? `
            <div class="details">
              <h4>상세 정보</h4>
              ${Object.entries(data.details).map(([key, value]) => 
                `<p><strong>${key}:</strong> ${value}</p>`
              ).join('')}
            </div>
          ` : ''}
          
          <p>본인의 활동이 아니라면 즉시 다음 조치를 취해 주세요:</p>
          <ul>
            <li>비밀번호를 변경하세요</li>
            <li>2단계 인증을 활성화하세요</li>
            <li>최근 로그인 기록을 확인하세요</li>
            <li>의심스러운 거래가 있는지 확인하세요</li>
          </ul>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.securityUrl}" class="button">보안 설정 확인</a>
          </p>
          
          <p>문의사항이 있으시면 즉시 <a href="mailto:${data.supportEmail}">${data.supportEmail}</a>로 연락해 주세요.</p>
          
          <p>감사합니다.<br>KRWX 보안팀 드림</p>
        </div>
      </body>
      </html>
    `;
  }

  private getDefaultTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KRWX 알림</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>KRWX 알림</h2>
          <p>${data.message || '알림이 도착했습니다.'}</p>
          <p>감사합니다.<br>KRWX 팀 드림</p>
        </div>
      </body>
      </html>
    `;
  }
} 