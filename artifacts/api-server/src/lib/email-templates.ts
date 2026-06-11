const BRAND_COLOR = "#0D9488";
const DARK_COLOR = "#00796B";

function baseTemplate(title: string, body: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: ${BRAND_COLOR}; padding: 28px 32px; text-align: center; }
    .header-logo { font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }
    .header-logo span { opacity: 0.8; }
    .body { padding: 32px; }
    .h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 12px; line-height: 1.3; }
    .p { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 16px; }
    .btn { display: inline-block; background: ${BRAND_COLOR}; color: #ffffff !important; padding: 13px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 8px 0 20px; }
    .card { background: #f0fdf9; border: 1px solid #ccfbf1; border-radius: 12px; padding: 16px 20px; margin: 16px 0; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${BRAND_COLOR}; margin-bottom: 8px; }
    .stat-row { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
    .stat { flex: 1; min-width: 80px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 900; color: ${BRAND_COLOR}; line-height: 1.2; }
    .stat-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { font-size: 12px; color: #94a3b8; line-height: 1.6; }
    .footer a { color: ${BRAND_COLOR}; text-decoration: none; }
    .warning { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 16px; margin: 12px 0; color: #dc2626; font-size: 14px; }
    .success { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin: 12px 0; color: #16a34a; font-size: 14px; }
    .list { list-style: none; padding: 0; margin: 12px 0; }
    .list li { padding: 6px 0; padding-left: 20px; position: relative; font-size: 14px; color: #475569; }
    .list li::before { content: "✓"; position: absolute; left: 0; color: ${BRAND_COLOR}; font-weight: 700; }
    @media (max-width: 600px) { .wrapper { margin: 0; border-radius: 0; } .body { padding: 24px 20px; } }
  </style>
</head>
<body>
  ${preheader ? `<div class="preheader">${preheader}</div>` : ""}
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Aperti<span>.</span></div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>This email was sent by <strong>Aperti Educational OS</strong>.<br/>
      Questions? <a href="mailto:support@aperti.app">support@aperti.app</a></p>
      <p style="margin-top:8px">© ${new Date().getFullYear()} Aperti. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

export function welcomeEmail(opts: { displayName: string; role: string; loginUrl: string }): { subject: string; html: string } {
  const roleLabel = opts.role === "teacher" ? "Teacher" : opts.role === "admin" ? "Administrator" : "Student";
  return {
    subject: `Welcome to Aperti — Your Educational OS`,
    html: baseTemplate(
      "Welcome to Aperti",
      `<h1 class="h1">Welcome to Aperti, ${opts.displayName}! 🎉</h1>
      <p class="p">Your <strong>${roleLabel}</strong> account is ready. Aperti is your all-in-one Educational OS for attendance, exams, flashcards, revision, analytics, and more.</p>
      <a href="${opts.loginUrl}" class="btn">Sign in to Aperti →</a>
      <div class="card">
        <div class="card-title">What you can do</div>
        <ul class="list">
          <li>Track attendance and student progress</li>
          <li>Create and manage assessments</li>
          <li>Build AI-powered revision materials</li>
          <li>Communicate with students and parents</li>
        </ul>
      </div>`,
      `Welcome to Aperti — your Educational OS is ready`
    ),
  };
}

export function attendanceAlertEmail(opts: {
  parentName: string;
  studentName: string;
  attendancePct: number;
  totalSessions: number;
  missedSessions: number;
  courseUrl: string;
}): { subject: string; html: string } {
  const isLow = opts.attendancePct < 70;
  return {
    subject: `Attendance Alert: ${opts.studentName} — ${opts.attendancePct}%`,
    html: baseTemplate(
      "Attendance Alert",
      `<h1 class="h1">Attendance Update for ${opts.studentName}</h1>
      <p class="p">Dear ${opts.parentName}, we wanted to keep you informed about ${opts.studentName}'s attendance record.</p>
      <div class="stat-row">
        <div class="stat"><div class="stat-value">${opts.attendancePct}%</div><div class="stat-label">Attendance</div></div>
        <div class="stat"><div class="stat-value">${opts.totalSessions}</div><div class="stat-label">Total Sessions</div></div>
        <div class="stat"><div class="stat-value">${opts.missedSessions}</div><div class="stat-label">Missed</div></div>
      </div>
      ${isLow ? `<div class="warning">⚠️ Attendance is below 70%. Please encourage ${opts.studentName} to attend all sessions.</div>` : `<div class="success">✓ Attendance is on track. Keep it up!</div>`}
      <a href="${opts.courseUrl}" class="btn">View Full Report →</a>`,
      `${opts.studentName}'s attendance is ${opts.attendancePct}%`
    ),
  };
}

export function examResultEmail(opts: {
  studentName: string;
  examName: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  courseUrl: string;
}): { subject: string; html: string } {
  const passed = opts.percentage >= 50;
  return {
    subject: `Exam Results: ${opts.examName} — ${opts.percentage}%`,
    html: baseTemplate(
      "Exam Results",
      `<h1 class="h1">Your Results: ${opts.examName}</h1>
      <p class="p">Hi ${opts.studentName}, your results for <strong>${opts.examName}</strong> are now available.</p>
      <div class="stat-row">
        <div class="stat"><div class="stat-value">${opts.percentage}%</div><div class="stat-label">Score</div></div>
        <div class="stat"><div class="stat-value">${opts.score}/${opts.maxScore}</div><div class="stat-label">Marks</div></div>
        <div class="stat"><div class="stat-value">${opts.grade}</div><div class="stat-label">Grade</div></div>
      </div>
      ${passed ? `<div class="success">✓ Congratulations! You passed this assessment.</div>` : `<div class="warning">This assessment needs more work. Speak to your teacher for guidance.</div>`}
      <a href="${opts.courseUrl}" class="btn">View Detailed Results →</a>`,
      `Your ${opts.examName} results are ready — ${opts.percentage}%`
    ),
  };
}

export function passwordResetEmail(opts: { displayName: string; resetUrl: string; expiresInMinutes: number }): { subject: string; html: string } {
  return {
    subject: `Reset Your Aperti Password`,
    html: baseTemplate(
      "Password Reset",
      `<h1 class="h1">Reset your password</h1>
      <p class="p">Hi ${opts.displayName}, we received a request to reset your Aperti password. Click the button below — this link expires in ${opts.expiresInMinutes} minutes.</p>
      <a href="${opts.resetUrl}" class="btn">Reset Password →</a>
      <div class="warning">If you didn't request this, you can safely ignore this email. Your password won't change.</div>`,
      `Reset your Aperti password — expires in ${opts.expiresInMinutes} minutes`
    ),
  };
}

export function homeworkReminderEmail(opts: {
  studentName: string;
  homeworkTitle: string;
  subjectName: string;
  dueDate: string;
  submitUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Homework Reminder: ${opts.homeworkTitle} due ${opts.dueDate}`,
    html: baseTemplate(
      "Homework Reminder",
      `<h1 class="h1">Homework Due Soon</h1>
      <p class="p">Hi ${opts.studentName}, a reminder that your homework for <strong>${opts.subjectName}</strong> is due soon.</p>
      <div class="card">
        <div class="card-title">Assignment Details</div>
        <p class="p" style="margin-bottom:4px"><strong>${opts.homeworkTitle}</strong></p>
        <p class="p" style="margin-bottom:0;color:#0D9488;font-weight:600">Due: ${opts.dueDate}</p>
      </div>
      <a href="${opts.submitUrl}" class="btn">Submit Now →</a>`,
      `Homework due: ${opts.homeworkTitle}`
    ),
  };
}

export function newEnrollmentEmail(opts: { teacherName: string; studentName: string; courseName: string; approveUrl: string }): { subject: string; html: string } {
  return {
    subject: `New Enrollment Request: ${opts.studentName} — ${opts.courseName}`,
    html: baseTemplate(
      "New Enrollment Request",
      `<h1 class="h1">New Enrollment Request</h1>
      <p class="p">Hi ${opts.teacherName}, <strong>${opts.studentName}</strong> has requested to enrol in your course <strong>${opts.courseName}</strong>.</p>
      <a href="${opts.approveUrl}" class="btn">Review Request →</a>`,
      `${opts.studentName} wants to join ${opts.courseName}`
    ),
  };
}
