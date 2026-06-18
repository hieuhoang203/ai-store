import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTicketDto, CreateWarrantyTicketDto, ListMyTicketsDto } from './dto/create-ticket.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Post('warranty')
  createWarranty(@Body() dto: CreateWarrantyTicketDto) {
    return this.ticketsService.createWarrantyTicket(dto);
  }

  @Post('my')
  listMine(@Body() dto: ListMyTicketsDto) {
    return this.ticketsService.listMine(dto);
  }

  @Get('users/:userId')
  listForUser(@Param('userId') userId: string) {
    return this.ticketsService.listForUser(userId);
  }
}
