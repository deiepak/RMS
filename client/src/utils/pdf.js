import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency, formatDateTime } from './helpers';

/**
 * Generate a professional bill PDF
 */
export const generateBillPDF = (orderData, settings = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Colors
  const primary = [233, 69, 96]; // accent-primary
  const dark = [26, 26, 46];
  const gray = [136, 146, 176];

  // Header line
  doc.setDrawColor(...primary);
  doc.setLineWidth(2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // Restaurant name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...dark);
  const restaurantName = settings.restaurant_name || 'Restaurant';
  doc.text(restaurantName, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  const address = settings.restaurant_address || '';
  const phone = settings.restaurant_phone ? ` | ${settings.restaurant_phone}` : '';
  if (address || phone) {
    doc.text(`${address}${phone}`, pageWidth / 2, y, { align: 'center' });
    y += 6;
  }
  
  if (settings.restaurant_website) {
    doc.text(settings.restaurant_website, pageWidth / 2, y, { align: 'center' });
    y += 10;
  } else {
    y += 4;
  }

  // Separator
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Order info
  doc.setFontSize(11);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text(`Table: ${orderData.table_number || 'N/A'}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDateTime(orderData.created_at || new Date())}`, pageWidth - margin, y, { align: 'right' });
  y += 7;
  doc.text(`Order #: ${orderData._id || orderData.id || 'N/A'}`, margin, y);
  y += 12;

  // Items table
  const items = orderData.items || [];
  
  // Merge items
  const mergedItems = [];
  items.filter(item => item.status !== 'rejected').forEach(item => {
    const itemName = item.menu_item_name || item.item_name || item.menu_item?.name || item.name || 'Item';
    const existing = mergedItems.find(i => {
      const iName = i.menu_item_name || i.item_name || i.menu_item?.name || i.name || 'Item';
      const p1 = Number(i.price_at_order || i.price || 0);
      const p2 = Number(item.price_at_order || item.price || 0);
      const c1 = i.customer_name || '-';
      const c2 = item.customer_name || '-';
      return iName === itemName && p1 === p2 && c1 === c2;
    });
    if (existing) {
      existing.quantity += item.quantity || 1;
    } else {
      mergedItems.push({ ...item, quantity: item.quantity || 1 });
    }
  });

  const tableData = mergedItems.map((item) => [
      item.menu_item_name || item.item_name || item.menu_item?.name || item.name || 'Item',
      item.quantity,
      item.customer_name || '-',
      formatCurrency(item.price_at_order || item.price || 0),
      formatCurrency((item.price_at_order || item.price || 0) * item.quantity),
    ]);

  doc.autoTable({
    startY: y,
    head: [['Item', 'Qty', 'Customer', 'Price', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 247],
      textColor: dark,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [80, 80, 80],
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 35 },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {},
  });

  y = doc.lastAutoTable.finalY + 10;

  // Per-person breakdown
  const byPerson = {};
  items.filter(item => item.status !== 'rejected').forEach((item) => {
    const name = item.customer_name || 'Guest';
    if (!byPerson[name]) byPerson[name] = 0;
    byPerson[name] += (item.price_at_order || item.price || 0) * (item.quantity || 1);
  });

  if (Object.keys(byPerson).length > 1) {
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...dark);
    doc.text('Per-Person Breakdown', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    Object.entries(byPerson).forEach(([name, total]) => {
      doc.text(name, margin + 4, y);
      doc.text(formatCurrency(total), pageWidth - margin, y, { align: 'right' });
      y += 6;
    });
    y += 4;
  }

  // Separator
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Summary
  const subtotal = orderData.subtotal || items.filter(i => i.status !== 'rejected').reduce((sum, item) => sum + (item.price_at_order || item.price || 0) * (item.quantity || 1), 0);
  const discount = orderData.discount_amount || orderData.discount || 0;
  const grandTotal = orderData.final_total || orderData.total || (subtotal - discount);

  doc.setFontSize(10);
  doc.setTextColor(...gray);

  const summaryX = pageWidth - margin;

  doc.text('Subtotal:', summaryX - 60, y);
  doc.text(formatCurrency(subtotal), summaryX, y, { align: 'right' });
  y += 7;

  if (discount > 0) {
    doc.setTextColor(34, 197, 94);
    const promoCodeStr = orderData.promo_code_name ? ` (${orderData.promo_code_name})` : (orderData.promoCode ? ` (${orderData.promoCode})` : '');
    doc.text(`Discount${promoCodeStr}:`, summaryX - 60, y);
    doc.text(`-${formatCurrency(discount)}`, summaryX, y, { align: 'right' });
    y += 7;
  }



  // Grand Total
  doc.setDrawColor(...primary);
  doc.setLineWidth(1);
  doc.line(summaryX - 80, y - 3, summaryX, y - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primary);
  doc.text('Grand Total:', summaryX - 60, y + 4);
  doc.text(formatCurrency(grandTotal), summaryX, y + 4, { align: 'right' });
  y += 20;

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Please visit again.', pageWidth / 2, y, { align: 'center' });

  return doc;
};

/**
 * Download bill PDF
 */
export const downloadBillPDF = (orderData, settings = {}) => {
  const doc = generateBillPDF(orderData, settings);
  const prefix = settings.restaurant_name ? settings.restaurant_name.replace(/\s+/g, '') : 'Restaurant';
  doc.save(`${prefix}_Bill_Table${orderData.table_number || 'X'}.pdf`);
};

/**
 * View bill PDF in new tab
 */
export const viewBillPDF = (orderData, settings = {}) => {
  const doc = generateBillPDF(orderData, settings);
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
};
