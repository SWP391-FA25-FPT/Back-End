import Report from '../models/Report.js';

// @desc    Create report
// @route   POST /api/report
// @access  Private
export const createReport = async (req, res) => {
  try {
    const { type, targetId, targetType, reason, description, severity } = req.body;

    if (!type || !targetId || !targetType || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ thông tin: type, targetId, targetType, reason',
      });
    }

    const report = await Report.create({
      userId: req.user._id,
      userEmail: req.user.email,
      userName: req.user.name || req.user.email,
      type,
      targetId,
      targetType,
      reason,
      description: description || '',
      severity: severity || 'medium',
    });

    res.status(201).json({
      success: true,
      message: 'Gửi report thành công',
      data: report,
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi gửi report',
    });
  }
};

// @desc    Get all reports (Admin only)
// @route   GET /api/report/admin/all
// @access  Private (Admin only)
export const getAllReportsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, severity } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }
    if (type) {
      query.type = type;
    }
    if (severity) {
      query.severity = severity;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email');

    const total = await Report.countDocuments(query);

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get all reports admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách reports',
    });
  }
};

// @desc    Update report status (Admin only)
// @route   PUT /api/report/admin/:id/status
// @access  Private (Admin only)
export const updateReportStatus = async (req, res) => {
  try {
    const { status, resolution } = req.body;

    if (!status || !['pending', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status không hợp lệ',
      });
    }

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy report',
      });
    }

    report.status = status;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    if (resolution) {
      report.resolution = resolution;
    }
    await report.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật status report thành công',
      data: report,
    });
  } catch (error) {
    console.error('Update report status error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy report',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật status report',
    });
  }
};

// @desc    Get report statistics (Admin only)
// @route   GET /api/report/admin/stats
// @access  Private (Admin only)
export const getReportStats = async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const reportsByStatus = await Report.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const reportsByType = await Report.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const reportsBySeverity = await Report.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const highSeverityReports = await Report.countDocuments({ severity: 'high' });

    res.status(200).json({
      success: true,
      data: {
        totalReports,
        reportsByStatus,
        reportsByType,
        reportsBySeverity,
        pendingReports,
        highSeverityReports,
      },
    });
  } catch (error) {
    console.error('Get report stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thống kê reports',
    });
  }
};

