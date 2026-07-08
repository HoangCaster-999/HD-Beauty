import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: vi });
}

export function formatDateTime(date: Date): string {
  return format(date, 'HH:mm dd/MM/yyyy', { locale: vi });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Giờ làm việc của nhân viên theo giờ Đức (Europe/Berlin): 9:00 sáng – 20:00 (8h tối)
export const STAFF_WORK_START_HOUR = 9;
export const STAFF_WORK_END_HOUR = 20;

// Lấy giờ hiện tại theo múi giờ Đức (0–23)
export function getBerlinHour(date: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hour12: false,
  }).format(date);
  const hour = parseInt(hourStr, 10);
  return Number.isNaN(hour) ? 0 : hour === 24 ? 0 : hour;
}

// Nhân viên chỉ được ghi/sửa doanh thu trong khung 9:00 – 20:00 giờ Đức
export function isWithinStaffWorkingHours(date: Date = new Date()): boolean {
  const hour = getBerlinHour(date);
  return hour >= STAFF_WORK_START_HOUR && hour < STAFF_WORK_END_HOUR;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getGradientColor(index: number): string {
  const gradients = [
    '#A78BFA',
    '#D8B4FE',
    '#A7F3D0',
    '#FBC8D4',
    '#F7C59F',
    '#93C5FD',
    '#FCA5A5',
    '#6EE7B7',
  ];
  return gradients[index % gradients.length];
}

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  import('xlsx').then(({ utils, write }) => {
    const ws = utils.json_to_sheet(data);

    // Auto column width based on content
    const cols = Object.keys(data[0] ?? {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.map((row) => String(row[key] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = cols;

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Báo cáo');

    // Dùng Blob + <a download> thay vì writeFile để tương thích iframe/webview
    const buf = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// Render bảng ra canvas (dùng font hệ thống → hỗ trợ tiếng Việt) rồi nhúng vào jsPDF và download
export async function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const { jsPDF } = await import('jspdf');
  const dateStr = formatDate(new Date());

  const SCALE = 2;          // retina
  const W     = 800;
  const M     = 36;         // margin ngang
  const TW    = W - M * 2;  // chiều rộng bảng
  const CW    = Math.floor(TW / headers.length);
  const ROW_H = 34;
  const TH_H  = 42;         // header row của bảng
  const TOP_H = 86;         // vùng tiêu đề + đường kẻ
  const H     = TOP_H + TH_H + ROW_H * rows.length + M;

  const canvas = document.createElement('canvas');
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Nền trắng
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Tiêu đề
  ctx.fillStyle = '#111111';
  ctx.font = `bold 18px sans-serif`;
  ctx.fillText(title, M, 36);

  // Ngày xuất
  ctx.fillStyle = '#6b7280';
  ctx.font = `12px sans-serif`;
  ctx.fillText(`Xuất ngày: ${dateStr}  ·  ${filename}`, M, 58);

  // Đường kẻ phân cách
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 72); ctx.lineTo(W - M, 72);
  ctx.stroke();

  // Header bảng (nền tím)
  const tY = TOP_H;
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(M, tY, TW, TH_H);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px sans-serif`;
  headers.forEach((h, i) => ctx.fillText(h, M + i * CW + 10, tY + 27));

  // Dòng dữ liệu
  rows.forEach((row, ri) => {
    const y = tY + TH_H + ri * ROW_H;

    ctx.fillStyle = ri % 2 ? '#f5f3ff' : '#fafafa';
    ctx.fillRect(M, y, TW, ROW_H);

    ctx.strokeStyle = '#ede9fe';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(M, y + ROW_H); ctx.lineTo(M + TW, y + ROW_H);
    ctx.stroke();

    ctx.fillStyle = '#111111';
    ctx.font = `13px sans-serif`;
    row.forEach((cell, ci) => {
      let text = String(cell);
      // Cắt text nếu tràn cột (measureText đo pixel chính xác)
      const maxW = CW - 22;
      while (ctx.measureText(text).width > maxW && text.length > 1) {
        text = text.slice(0, -1);
      }
      if (text !== String(cell)) text = text.slice(0, -1) + '…';
      ctx.fillText(text, M + ci * CW + 10, y + 22);
    });
  });

  // Viền ngoài bảng
  ctx.strokeStyle = '#ddd6fe';
  ctx.lineWidth = 1;
  ctx.strokeRect(M, tY, TW, TH_H + ROW_H * rows.length);

  // Đưa canvas vào jsPDF rồi download
  const imgData = canvas.toDataURL('image/png');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pdfM  = 10;
  const imgW  = pageW - pdfM * 2;
  const imgH  = (H / W) * imgW;

  doc.addImage(imgData, 'PNG', pdfM, pdfM, imgW, imgH);
  doc.save(`${filename}.pdf`);
}

// In báo cáo — inject overlay vào document hiện tại, gọi window.print() (tương thích iframe/WebCake)
export function printReport(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const dateStr = formatDate(new Date());

  const rowsHtml = rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 === 1 ? '#f5f3ff' : '#fff'}">
          ${row.map((cell) => `<td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${cell}</td>`).join('')}
        </tr>`
    )
    .join('');

  const style = document.createElement('style');
  style.setAttribute('data-hd-print-style', '');
  style.textContent = `
    @media print {
      body > *:not([data-hd-print]) { visibility: hidden !important; }
      [data-hd-print] {
        visibility: visible !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 99999 !important;
        background: #fff !important;
        padding: 24px !important;
        font-family: Arial, sans-serif !important;
        color: #111 !important;
      }
      @page { margin: 1.5cm; }
    }
    [data-hd-print] { display: none; }
  `;

  const el = document.createElement('div');
  el.setAttribute('data-hd-print', '');
  el.innerHTML = `
    <h1 style="font-size:18px;margin:0 0 4px">${title}</h1>
    <div style="font-size:12px;color:#6b7280;margin-bottom:20px">Xuất ngày: ${dateStr} &nbsp;|&nbsp; ${filename}</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#7c3aed">${headers.map((h) => `<th style="color:#fff;padding:9px 12px;text-align:left;font-size:13px;font-weight:600">${h}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  document.head.appendChild(style);
  document.body.appendChild(el);

  const cleanup = () => {
    if (document.head.contains(style)) document.head.removeChild(style);
    if (document.body.contains(el)) document.body.removeChild(el);
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 60_000);

  window.print();
}
