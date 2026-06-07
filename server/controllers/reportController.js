const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const db = require('../models/db');
const path = require('path');
const fs = require('fs');

exports.generateReport = async (req, res) => {
  const { type } = req.params; // 'pdf' or 'excel'
  const { district, state } = req.query;

  try {
    // 1. Fetch shipments data for the report
    let queryText = `
      SELECT s.id, s.product_name, s.quantity_dispatched, s.quantity_received, s.shortage_reported,
             s.dispatch_time, s.expected_delivery, s.actual_delivery, s.status,
             w.warehouse_name, fps.shop_name, v.vehicle_number
      FROM shipments s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN fair_price_shops fps ON s.fps_id = fps.id
      JOIN vehicles v ON s.vehicle_id = v.id
    `;
    const params = [];
    let paramIdx = 1;

    // Filter by district/state (optional)
    if (district) {
      queryText += ` WHERE fps.address ILIKE $${paramIdx} OR w.address ILIKE $${paramIdx}`;
      params.push(`%${district}%`);
      paramIdx++;
    }

    queryText += ` ORDER BY s.id DESC`;
    const shipmentRes = await db.query(queryText, params);
    const shipments = shipmentRes.rows;

    // 2. Fetch alerts count for summary
    const alertsRes = await db.query(
      `SELECT a.*, s.product_name FROM alerts a JOIN shipments s ON a.shipment_id = s.id`
    );
    const alerts = alertsRes.rows;

    if (type === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=RationX_Report_${Date.now()}.pdf`);

      doc.pipe(res);

      // Title Section
      doc.fillColor('#1e293b').fontSize(22).text('RationX - Smart PDS Supply Chain Report', { align: 'center' });
      doc.fontSize(10).fillColor('#64748b').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Filter settings
      if (district || state) {
        doc.fontSize(11).fillColor('#475569').text(`Filters - District: ${district || 'All'}, State: ${state || 'All'}`);
        doc.moveDown(1);
      }

      // Summary KPI boxes
      doc.rect(50, doc.y, 510, 60).fill('#f1f5f9');
      doc.fillColor('#0f172a').fontSize(12).text('Supply Chain Summary KPIs', 60, doc.y + 10);
      doc.fontSize(10).fillColor('#475569')
         .text(`Total Shipments: ${shipments.length} | Total Alerts: ${alerts.length} | Leakages/Mismatches: ${alerts.filter(a => a.alert_type === 'quantity_mismatch').length}`, 60, doc.y + 5);
      doc.moveDown(4);

      // Shipments List
      doc.fillColor('#0f172a').fontSize(14).text('Shipment Logs', 50, doc.y);
      doc.moveDown(0.5);

      // Table Header
      let currentY = doc.y;
      doc.rect(50, currentY, 510, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(9);
      doc.text('ID', 55, currentY + 5);
      doc.text('Product', 85, currentY + 5);
      doc.text('Warehouse', 145, currentY + 5);
      doc.text('FPS Shop', 235, currentY + 5);
      doc.text('Qty Disp', 325, currentY + 5);
      doc.text('Qty Recv', 375, currentY + 5);
      doc.text('Shortage', 425, currentY + 5);
      doc.text('Status', 485, currentY + 5);

      doc.moveDown(1.5);

      // Table rows
      doc.fillColor('#334155');
      shipments.slice(0, 15).forEach((ship, idx) => {
        let rowY = doc.y;
        
        // Zebra striping
        if (idx % 2 === 0) {
          doc.rect(50, rowY - 2, 510, 16).fill('#f8fafc');
        }
        
        doc.fillColor('#334155');
        doc.text(ship.id.toString(), 55, rowY);
        doc.text(ship.product_name, 85, rowY);
        doc.text(ship.warehouse_name.substring(0, 15), 145, rowY);
        doc.text(ship.shop_name.substring(0, 15), 235, rowY);
        doc.text(ship.quantity_dispatched.toString(), 325, rowY);
        doc.text(ship.quantity_received ? ship.quantity_received.toString() : '-', 375, rowY);
        doc.text(ship.shortage_reported ? ship.shortage_reported.toString() : '0', 425, rowY);
        
        // Status color coding
        if (ship.status === 'delivered') doc.fillColor('#16a34a');
        else if (ship.status === 'delayed') doc.fillColor('#dc2626');
        else doc.fillColor('#ea580c');
        
        doc.text(ship.status.toUpperCase(), 485, rowY);
        doc.moveDown(1.1);
      });

      if (shipments.length > 15) {
        doc.fillColor('#94a3b8').fontSize(8).text(`... and ${shipments.length - 15} more shipments. Export to Excel for the full list.`, { align: 'center' });
      }

      doc.moveDown(2);

      // Alerts Section
      doc.fillColor('#0f172a').fontSize(14).text('Security Alerts Log', 50, doc.y);
      doc.moveDown(0.5);

      let alertY = doc.y;
      doc.rect(50, alertY, 510, 20).fill('#991b1b');
      doc.fillColor('#ffffff').fontSize(9);
      doc.text('ID', 55, alertY + 5);
      doc.text('Alert Type', 85, alertY + 5);
      doc.text('Severity', 185, alertY + 5);
      doc.text('Risk Score', 255, alertY + 5);
      doc.text('Details', 315, alertY + 5);

      doc.moveDown(1.5);
      doc.fillColor('#334155');

      alerts.slice(0, 10).forEach((alert, idx) => {
        let rowY = doc.y;
        if (idx % 2 === 0) {
          doc.rect(50, rowY - 2, 510, 16).fill('#fef2f2');
        }
        doc.fillColor('#334155');
        doc.text(alert.id.toString(), 55, rowY);
        doc.text(alert.alert_type.toUpperCase(), 85, rowY);
        doc.text(alert.severity.toUpperCase(), 185, rowY);
        doc.text(alert.risk_score.toString(), 255, rowY);
        doc.text(alert.details ? alert.details.substring(0, 40) + '...' : 'N/A', 315, rowY);
        doc.moveDown(1.1);
      });

      // Footer
      doc.fillColor('#64748b').fontSize(8).text('RationX PDS Security Management - Confidential Government Report', 50, 720, { align: 'center' });

      doc.end();

      // Log report generation in DB
      await db.query(
        "INSERT INTO reports (report_type, district, state, file_path, generated_by) VALUES ($1, $2, $3, $4, $5)",
        ['pdf', district || 'All', state || 'All', 'streamed_directly', req.user.id]
      );

    } else if (type === 'excel') {
      // Map JSON properties to excel columns
      const excelData = shipments.map(s => ({
        'Shipment ID': s.id,
        'Product Name': s.product_name,
        'Warehouse': s.warehouse_name,
        'Fair Price Shop': s.shop_name,
        'Vehicle Number': s.vehicle_number,
        'Quantity Dispatched': s.quantity_dispatched,
        'Quantity Received': s.quantity_received || 'In Transit',
        'Shortage Reported': s.shortage_reported || 0,
        'Dispatch Time': s.dispatch_time ? new Date(s.dispatch_time).toLocaleString() : 'N/A',
        'Expected Delivery': new Date(s.expected_delivery).toLocaleString(),
        'Actual Delivery': s.actual_delivery ? new Date(s.actual_delivery).toLocaleString() : 'N/A',
        'Status': s.status.toUpperCase()
      }));

      const alertData = alerts.map(a => ({
        'Alert ID': a.id,
        'Shipment ID': a.shipment_id,
        'Product': a.product_name,
        'Alert Type': a.alert_type.toUpperCase(),
        'Severity': a.severity.toUpperCase(),
        'Risk Score': a.risk_score,
        'Resolved': a.resolved ? 'YES' : 'NO',
        'Details': a.details,
        'Created At': new Date(a.created_at).toLocaleString()
      }));

      const wb = XLSX.utils.book_new();
      const wsShipments = XLSX.utils.json_to_sheet(excelData);
      const wsAlerts = XLSX.utils.json_to_sheet(alertData);

      XLSX.utils.book_append_sheet(wb, wsShipments, 'Shipment Records');
      XLSX.utils.book_append_sheet(wb, wsAlerts, 'Anomalies and Alerts');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=RationX_Report_${Date.now()}.xlsx`);
      res.send(buffer);

      // Log report generation in DB
      await db.query(
        "INSERT INTO reports (report_type, district, state, file_path, generated_by) VALUES ($1, $2, $3, $4, $5)",
        ['excel', district || 'All', state || 'All', 'streamed_directly', req.user.id]
      );
    } else {
      res.status(400).json({ message: 'Invalid report format type.' });
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ message: 'Server error generating reports.' });
  }
};
