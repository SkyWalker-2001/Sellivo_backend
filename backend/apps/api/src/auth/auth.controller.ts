import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto, TokensDto } from "./dto";
import { Public, CurrentUser } from "../common/decorators";
import { JwtRefreshGuard } from "./guards";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Bootstrap a new organization + owner" })
  register(@Body() dto: RegisterDto): Promise<TokensDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Staff login (owner/manager/cashier)" })
  login(@Body() dto: LoginDto): Promise<TokensDto> {
    return this.auth.login(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Exchange a refresh token for new tokens" })
  refresh(@CurrentUser("userId") userId: string): Promise<TokensDto> {
    return this.auth.refresh(userId);
  }

  @Post("logout")
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout (stateless — client discards tokens)" })
  logout(): void {
    // Access tokens are short-lived and stateless; nothing to revoke server-side in MVP.
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current authenticated user" })
  me(@CurrentUser("userId") userId: string) {
    return this.auth.me(userId);
  }
}
