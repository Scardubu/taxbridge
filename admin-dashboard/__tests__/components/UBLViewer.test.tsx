import { render, screen, waitFor } from '@testing-library/react';
import { UBLViewer } from '@/components/UBLViewer';

// Mock xml2js
jest.mock('xml2js', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parseString: jest.fn().mockImplementation((xml, callback) => {
      // Mock successful parsing - only call callback once
      if (xml) {
        callback(null, {
          Invoice: {
            'cbc:ID': ['INV-001'],
            'cbc:IssueDate': ['2026-01-07'],
            'cac:AccountingSupplierParty': [{
              'cac:Party': [{
                'cac:PartyIdentification': [{
                  'cbc:ID': ['12345678901']
                }]
              }]
            }]
          }
        });
      }
    })
  }))
}));

describe('UBLViewer', () => {
  const mockUBLXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID>INV-001</cbc:ID>
  <cbc:IssueDate>2026-01-07</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="TIN">12345678901</cbc:ID>
      </cac:PartyIdentification>
    </cac:Party>
  </cac:AccountingSupplierParty>
</Invoice>`;

  it('renders UBL XML viewer with compliance score', async () => {
    render(<UBLViewer xml={mockUBLXml} />);
    
    await waitFor(() => {
      expect(screen.getByText('UBL 3.0 Compliance Check')).toBeInTheDocument();
    });
    expect(screen.getByText(/Complete/)).toBeInTheDocument();
  });

  it('displays mandatory fields validation', async () => {
    render(<UBLViewer xml={mockUBLXml} />);
    
    // Wait for parsing to complete
    await waitFor(() => {
      expect(screen.getByText('Invoice number')).toBeInTheDocument();
    });
    expect(screen.getByText('Invoice date (YYYY-MM-DD)')).toBeInTheDocument();
  });

  it('shows raw XML tab button', async () => {
    render(<UBLViewer xml={mockUBLXml} />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Raw XML' })).toBeInTheDocument();
    });
  });

  it('handles empty XML gracefully', () => {
    const { container } = render(<UBLViewer xml="" />);
    
    // When xml is empty, the component should render without crashing
    expect(container).toBeTruthy();
  });
});
