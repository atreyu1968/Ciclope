import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Post()
  create(@Body() dto: CreateActionDto) { return this.actions.create(dto); }

  @Get()
  findAll(@Query('status') status?: string) { return this.actions.findAll(status); }

  @Patch(':id/validate')
  validate(@Param('id') id: string) { return this.actions.validate(id); }
}
