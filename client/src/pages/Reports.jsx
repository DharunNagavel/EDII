import React, { useState } from 'react';
import { FileText, Download, Award, FileSpreadsheet } from 'lucide-react';
import { reports } from '../services/api';

const Reports = () => {
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleDownload = (format) => {
    // Generate direct download URL
    const url = reports.downloadUrl(format, district, state);
    
    // Open in new window or hidden anchor trigger
    window.open(url, '_blank');
    
    setSuccessMsg(`Initiated ${format.toUpperCase()} report download successfully!`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-title">
          <h2>PDS Reports & Analytics</h2>
          <p>Download monthly distribution records, district summaries, and leakage analysis</p>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '0.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="dashboard-grid">
        {/* PDF Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)', marginBottom: '1rem' }}>
              <div style={{ width: '48px', height: '48px', background: 'rgba(239,68,68,0.1)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>PDF Compliance Summary</h3>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Generates a beautifully formatted PDF report containing key performance indicators, active shipment audits, and a list of security alerts detected by the AI anomaly engine. 
              Ideal for executive review and statutory filing.
            </p>
            
            <div className="form-group">
              <label>Filter by District Name (Optional)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Chennai" 
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', gap: '0.5rem', background: 'var(--danger-gradient)', boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.2)' }}
            onClick={() => handleDownload('pdf')}
          >
            <Download size={16} />
            <span>Generate & Download PDF</span>
          </button>
        </div>

        {/* Excel Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--success)', marginBottom: '1rem' }}>
              <div style={{ width: '48px', height: '48px', background: 'rgba(16,185,129,0.1)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSpreadsheet size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Excel Data Ledger</h3>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Generates a full spreadsheet containing detailed multiple worksheets: one for shipment histories (including expected vs actual times and shortage logs) and another for AI alerts. 
              Ideal for deep data audits, filtering, and custom graph generation.
            </p>

            <div className="form-group">
              <label>Filter by State Name (Optional)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Tamil Nadu" 
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', gap: '0.5rem', background: 'var(--success-gradient)', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.2)' }}
            onClick={() => handleDownload('excel')}
          >
            <Download size={16} />
            <span>Generate & Download Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;
