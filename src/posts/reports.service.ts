import { Injectable, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus } from './entities/report.entity';
import { Post } from './entities/post.entity';
import { CreateReportDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async createReport(
    reporterId: string,
    createReportDto: CreateReportDto,
  ): Promise<Report> {
    // Block reporting your own post
    if (createReportDto.entityType === 'post') {
      const post = await this.postsRepository.findOne({
        where: { id: createReportDto.entityId },
        select: ['authorId'],
      });
      if (post && post.authorId === reporterId) {
        throw new ForbiddenException('You cannot report your own post');
      }
    }

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
