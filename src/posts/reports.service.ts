import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus } from './entities/report.entity';
import { CreateReportDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
  ) {}

  async createReport(
    reporterId: string,
    createReportDto: CreateReportDto,
  ): Promise<Report> {
    // Check for duplicate report
    const existing = await this.reportsRepository.findOne({
      where: {
        reporterId,
        entityId: createReportDto.entityId,
        entityType: createReportDto.entityType,
        status: ReportStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException('You have already reported this content');
    }

    const report = this.reportsRepository.create({
      ...createReportDto,
      reporterId,
    });

    return this.reportsRepository.save(report);
  }

  async getMyReports(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<Report[]> {
    return this.reportsRepository.find({
      where: { reporterId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
  }
}
