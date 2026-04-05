/**
 * DocumentTypeService — Static catalog of tax document types.
 *
 * Provides a read-only catalog of document types with descriptions,
 * instructions, and applicable entity types for the Document Request Creator.
 *
 * Requirements: 7.1, 7.2
 */

const DOCUMENT_TYPE_CATALOG = [
  {
    id: 'w-2',
    name: 'W-2 Form',
    category: 'Income',
    description: 'Wage and Tax Statement issued by employers showing annual wages, tips, and taxes withheld.',
    instructions: 'Request from your employer or download from their payroll portal. Ensure all copies (federal, state) are included.',
    applicableEntityTypes: ['Individual'],
  },
  {
    id: '1099-div',
    name: '1099-DIV',
    category: 'Income',
    description: 'Dividends and Distributions statement from banks, brokerages, or mutual funds.',
    instructions: 'Obtain from each financial institution where you hold investments. Available in January–February.',
    applicableEntityTypes: ['Individual', 'Business', 'Trust'],
  },
  {
    id: '1099-int',
    name: '1099-INT',
    category: 'Income',
    description: 'Interest Income statement from banks and financial institutions for interest earned.',
    instructions: 'Request from each bank or financial institution. Check online banking portals for electronic copies.',
    applicableEntityTypes: ['Individual', 'Business', 'Trust'],
  },
  {
    id: '1099-misc',
    name: '1099-MISC',
    category: 'Income',
    description: 'Miscellaneous income including rents, royalties, and other non-employee compensation.',
    instructions: 'Collect from all payers who issued this form. Report all amounts even if no form was received.',
    applicableEntityTypes: ['Individual', 'Business'],
  },
  {
    id: '1099-nec',
    name: '1099-NEC',
    category: 'Income',
    description: 'Nonemployee Compensation for freelance, contract, or gig work income.',
    instructions: 'Collect from all clients or platforms that paid you $600 or more during the tax year.',
    applicableEntityTypes: ['Individual', 'Business'],
  },
  {
    id: '1098',
    name: '1098 Mortgage Interest',
    category: 'Deductions',
    description: 'Mortgage Interest Statement showing interest paid on a home mortgage during the year.',
    instructions: 'Obtain from your mortgage lender. Available in January. Include all properties with mortgages.',
    applicableEntityTypes: ['Individual'],
  },
  {
    id: '1098-t',
    name: '1098-T Tuition',
    category: 'Deductions',
    description: 'Tuition Statement from educational institutions for education credits or deductions.',
    instructions: 'Download from your school\'s student portal. Verify amounts match your payment records.',
    applicableEntityTypes: ['Individual'],
  },
  {
    id: 'schedule-c',
    name: 'Schedule C',
    category: 'Business',
    description: 'Profit or Loss from Business for sole proprietors reporting business income and expenses.',
    instructions: 'Prepare a summary of all business income and expenses. Include receipts for major deductions.',
    applicableEntityTypes: ['Individual', 'Business'],
  },
  {
    id: 'schedule-k1',
    name: 'Schedule K-1',
    category: 'Business',
    description: 'Partner\'s or Shareholder\'s Share of Income, Deductions, Credits from partnerships or S-Corps.',
    instructions: 'Obtain from the partnership or S-Corp. May arrive later than other tax documents (March–April).',
    applicableEntityTypes: ['Individual', 'Business', 'S-Corp', 'Partnership', 'Trust'],
  },
  {
    id: 'trust-agreement',
    name: 'Trust Agreement',
    category: 'Trust',
    description: 'Copy of the trust agreement establishing the trust, its terms, and beneficiaries.',
    instructions: 'Provide the most recent version of the trust agreement including any amendments.',
    applicableEntityTypes: ['Trust'],
  },
  {
    id: 'bank-statement',
    name: 'Bank Statements',
    category: 'Financial',
    description: 'Year-end bank statements showing account balances, interest earned, and transactions.',
    instructions: 'Download December statements from all bank accounts. Include checking, savings, and money market accounts.',
    applicableEntityTypes: ['Individual', 'Business', 'Trust', 'S-Corp', 'Partnership'],
  },
  {
    id: 'donation-receipt',
    name: 'Charitable Donation Receipts',
    category: 'Deductions',
    description: 'Receipts and acknowledgment letters for charitable contributions made during the tax year.',
    instructions: 'Collect receipts for all donations over $250. Include both cash and non-cash contributions.',
    applicableEntityTypes: ['Individual', 'Business', 'Trust'],
  },
];

export class DocumentTypeService {
  constructor() {
    /** @type {Map<string, object>} typeId → DocumentType */
    this._catalog = new Map();

    for (const docType of DOCUMENT_TYPE_CATALOG) {
      this._catalog.set(docType.id, { ...docType });
    }
  }

  /**
   * Returns all document types, optionally filtered by entity type.
   *
   * @param {string} [projectType] - Entity type to filter by (e.g. 'Individual', 'Business', 'Trust')
   * @returns {object[]} DocumentType[]
   */
  getDocumentTypes(projectType) {
    let types = Array.from(this._catalog.values()).map((t) => ({ ...t }));

    if (projectType && projectType.trim()) {
      const normalized = projectType.trim();
      types = types.filter((t) =>
        t.applicableEntityTypes.some(
          (et) => et.toLowerCase() === normalized.toLowerCase()
        )
      );
    }

    return types;
  }

  /**
   * Returns a single document type with full description and instructions,
   * or null if not found.
   *
   * @param {string} typeId
   * @returns {object | null} DocumentType or null
   */
  getDocumentType(typeId) {
    if (!typeId) return null;
    const docType = this._catalog.get(typeId);
    return docType ? { ...docType } : null;
  }
}

// Singleton instance
const documentTypeService = new DocumentTypeService();
export { DOCUMENT_TYPE_CATALOG };
export default documentTypeService;
