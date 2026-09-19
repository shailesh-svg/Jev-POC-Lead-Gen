"""Classify a PDF's extracted text without generating or extracting field values."""
from typesafe_sdk import AsyncTypeSafeClient, Choice, RetryPolicy
from .prompts import CLASSIFY, request_trace
from .validation import bounded

CATEGORIES = {
    'invoice': {'label': 'Invoice', 'description': 'A bill requesting payment for goods or services, with amounts owed. Includes tax invoices and pro forma invoices. Excludes receipts confirming payment and purchase orders.'},
    'resume': {'label': 'Resume', 'description': 'A CV or resume describing a person’s professional experience, education, and skills.'},
    'sow': {'label': 'Statement of work', 'description': 'A project-specific statement of work defining scope, deliverables, responsibilities, timelines, and acceptance criteria. Prefer this over contract for an explicit SOW.'},
    'proposal': {'label': 'Proposal', 'description': 'An offer or recommendation seeking approval for work, a product, or a project. Includes bids and quotations; not an invoice requesting payment.'},
    'purchase_order': {'label': 'Purchase order', 'description': 'An order issued by a buyer to a supplier specifying goods or services, quantities, and agreed prices.'},
    'contract': {'label': 'Contract / agreement', 'description': 'An agreement primarily defining legal or commercial obligations, such as a supplier agreement or NDA. Excludes project-specific statements of work and insurance policies. Includes loan agreements establishing borrowing terms, but not periodic loan statements.'},
    'receipt': {'label': 'Receipt', 'description': 'A record confirming that payment has been received, rather than requesting payment.'},
    'catalogue': {'label': 'Product catalogue', 'description': 'A collection of product listings, specifications, identifiers, or prices intended to describe available products.'},
    'report': {'label': 'Report', 'description': 'A document presenting findings, analysis, status, or results, rather than offering work or requesting payment. Use a more specific category for financial statements, account statements, tax filings, and insurance policies.'},
    'bank_statement': {'label': 'Bank statement', 'description': 'A periodic statement for a bank deposit, current, checking, or savings account listing deposits, withdrawals, transactions, and opening or closing balances. Excludes credit card, loan, and investment account statements.'},
    'credit_card_statement': {'label': 'Credit card statement', 'description': 'A periodic credit card bill listing card purchases, payments, credit limit, balance due, and minimum payment. Prefer this over invoice or bank statement for a card account.'},
    'investment_statement': {'label': 'Investment / brokerage statement', 'description': 'A periodic investment, brokerage, securities, or fund account statement showing holdings, trades, market values, or investment returns. Excludes an organization’s financial statements and ordinary bank deposit accounts.'},
    'loan_statement': {'label': 'Loan / mortgage statement', 'description': 'A periodic loan or mortgage account statement showing principal outstanding, interest, installments, payments, or amount due. Excludes loan agreements that establish borrowing terms.'},
    'financial_statement': {'label': 'Financial statements', 'description': 'An entity’s balance sheet, income or profit-and-loss statement, cash-flow statement, or a financial reporting package centered on these statements. Excludes personal bank or investment account statements.'},
    'account_statement': {'label': 'Customer / supplier account statement', 'description': 'A statement of account listing invoices, credit notes, payments, and an outstanding trade balance between a customer and supplier. Excludes a single invoice and statements for bank, card, loan, or investment accounts.'},
    'remittance_advice': {'label': 'Remittance advice', 'description': 'A notice from a payer explaining which invoices a payment covers, payment references, and payment allocations. Excludes a receipt issued by a recipient to acknowledge payment.'},
    'payslip': {'label': 'Payslip / salary statement', 'description': 'An employee’s pay slip or salary statement showing earnings, deductions, pay period, and net pay. Excludes general bank statements that merely include salary deposits.'},
    'tax_return': {'label': 'Tax return / filing', 'description': 'A completed tax return, tax computation, or tax filing acknowledgment whose main purpose is reporting tax information. Excludes tax invoices requesting payment for goods or services.'},
    'insurance_policy': {'label': 'Insurance policy / certificate', 'description': 'An insurance policy, coverage schedule, or certificate of insurance identifying the insured party, coverage, policy period, or limits. Excludes insurance premium invoices and claim-status reports.'},
    'other': {'label': 'Other / mixed', 'description': 'None of these categories fits, or the PDF contains several distinct document types with no clear main type.'},
}

OPTIONS = {id: item['description'] for id, item in CATEGORIES.items()}

async def classify(text, key):
    async with AsyncTypeSafeClient(api_key=key, timeout=60, retry=RetryPolicy(max_retries=1)) as client:
        response = await client.system_one(state={'document': text}, questions={'document_type': Choice(instructions=CLASSIFY, criteria=OPTIONS)})
    answer = response.choices['document_type']
    if answer.choice not in CATEGORIES:
        raise ValueError('Unknown category')
    confidence = bounded(answer.confidence, message='Invalid probability')
    probabilities = {id: bounded(answer.probabilities[id], message='Invalid probability') for id in CATEGORIES}
    ranked = sorted(probabilities.values(), reverse=True)
    return {
        'category': answer.choice,
        'label': CATEGORIES[answer.choice]['label'],
        'confidence': confidence,
        'probabilities': probabilities,
        'needs_review': confidence < .7 or ranked[0] - ranked[1] < .15 or answer.choice == 'other',
        'requests': [request_trace(response)],
    }
