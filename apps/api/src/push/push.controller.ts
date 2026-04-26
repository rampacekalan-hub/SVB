import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class SubscribeDto {
  @IsString() endpoint!: string;
  @IsObject() keys!: { p256dh: string; auth: string };
}

class UnsubscribeDto {
  @IsString() endpoint!: string;
}

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** Verejný VAPID kľúč pre client-side subscribe. */
  @Get('public-key')
  publicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: { user: { id: string }; headers: Record<string, string> },
    @Body() dto: SubscribeDto,
  ) {
    return this.push.subscribe(req.user.id, dto, req.headers['user-agent']);
  }

  @Delete('subscribe')
  async unsubscribe(@Req() req: { user: { id: string } }, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(req.user.id, dto.endpoint);
  }

  /** Dev helper — pošle test push aktuálnemu userovi. */
  @Post('test')
  async test(@Req() req: { user: { id: string } }) {
    return this.push.sendToUser(req.user.id, {
      title: 'Floory test',
      body: 'Push notifikácie fungujú 🎉',
      url: '/',
    });
  }
}
