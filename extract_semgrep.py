"""
Semgrep Results Extractor
=========================
Place this script in your project folder alongside the Semgrep JSON output files.

Expected file naming convention:
    scenario{N}_{tool}.json
    
    Examples:
    scenario1_deepseek.json
    scenario1_chatgpt.json
    scenario1_claude.json
    scenario2_deepseek.json
    ...

Run: python extract_semgrep.py

Output: semgrep_results.xlsx (structured summary of all findings)
"""

import json
import os
import glob
import sys

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
except ImportError:
    print("openpyxl not installed. Run: pip install openpyxl")
    sys.exit(1)

SCENARIOS = {
    1: "User authentication",
    2: "SQL query with user input",
    3: "Input validation",
    4: "File upload handling",
    5: "JWT implementation",
    6: "CORS configuration",
    7: "Password reset flow",
    8: "Role-based access control",
    9: "Rate limiting and error handling",
    10: "NoSQL injection",
}

TOOLS = ["deepseek", "chatgpt", "claude"]

def parse_semgrep_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    findings = []
    for r in data.get('results', []):
        meta = r.get('extra', {}).get('metadata', {})
        
        cwes = meta.get('cwe', [])
        cwe = cwes[0] if cwes else 'N/A'
        
        owasp_list = meta.get('owasp', [])
        owasp_2021 = 'N/A'
        for o in owasp_list:
            if '2021' in o:
                owasp_2021 = o
                break
        if owasp_2021 == 'N/A' and owasp_list:
            owasp_2021 = owasp_list[0]
        
        vuln_class = meta.get('vulnerability_class', [])
        vuln_class_str = vuln_class[0] if vuln_class else 'N/A'
        
        findings.append({
            'rule_id': r.get('check_id', 'N/A').split('.')[-1],
            'full_rule_id': r.get('check_id', 'N/A'),
            'severity': r.get('extra', {}).get('severity', 'N/A'),
            'message': r.get('extra', {}).get('message', 'N/A')[:100],
            'cwe': cwe,
            'owasp': owasp_2021,
            'vulnerability_class': vuln_class_str,
            'likelihood': meta.get('likelihood', 'N/A'),
            'impact': meta.get('impact', 'N/A'),
            'confidence': meta.get('confidence', 'N/A'),
            'line_start': r.get('start', {}).get('line', 'N/A'),
            'line_end': r.get('end', {}).get('line', 'N/A'),
            'code_snippet': r.get('extra', {}).get('lines', '')[:150],
        })
    
    return findings


def find_json_files():
    found = {}
    patterns = [
        'scenario*_*.json',
        'prob-*_*.json',
        'prob-*.json',
        'scenario*.json',
    ]
    
    all_files = []
    for p in patterns:
        all_files.extend(glob.glob(p))
    
    if not all_files:
        all_files = glob.glob('*.json')
    
    for f in all_files:
        found[f] = f
    
    return found


def create_excel(all_results):
    wb = Workbook()
    
    header_fill = PatternFill('solid', fgColor='4472C4')
    header_font = Font(bold=True, color='FFFFFF', name='Arial', size=10)
    normal_font = Font(name='Arial', size=9)
    bold_font = Font(name='Arial', size=9, bold=True)
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    
    severity_colors = {
        'CRITICAL': PatternFill('solid', fgColor='FFC7CE'),
        'ERROR': PatternFill('solid', fgColor='FFC7CE'),
        'WARNING': PatternFill('solid', fgColor='FFEB9C'),
        'INFO': PatternFill('solid', fgColor='D6E4F0'),
    }
    
    # Sheet 1: All Findings
    ws = wb.active
    ws.title = "All Findings"
    
    headers = ['File', 'Scenario', 'Tool', '#', 'Severity', 'Vulnerability', 
               'CWE', 'OWASP 2021', 'Impact', 'Likelihood', 'Confidence', 
               'Line', 'Code Snippet']
    
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border
    
    row_num = 2
    for filename, findings in sorted(all_results.items()):
        name_lower = filename.lower().replace('.json', '')
        
        scenario = 'Unknown'
        tool = 'Unknown'
        for sn, sname in SCENARIOS.items():
            if str(sn) in name_lower or sname.lower().split()[0] in name_lower:
                scenario = f"S{sn}: {sname}"
                break
        for t in TOOLS:
            if t in name_lower:
                tool = t.capitalize()
                break
        
        for i, f in enumerate(findings, 1):
            data = [
                filename, scenario, tool, i, f['severity'], f['message'],
                f['cwe'], f['owasp'], f['impact'], f['likelihood'],
                f['confidence'], f['line_start'], f['code_snippet']
            ]
            
            sev_fill = severity_colors.get(f['severity'], PatternFill())
            
            for col, val in enumerate(data, 1):
                cell = ws.cell(row=row_num, column=col, value=val)
                cell.font = normal_font
                cell.border = thin_border
                cell.fill = sev_fill
                if col in [6, 7, 13]:
                    cell.alignment = Alignment(wrap_text=True, vertical='center')
                else:
                    cell.alignment = Alignment(vertical='center')
            
            row_num += 1
    
    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 25
    ws.column_dimensions['C'].width = 12
    ws.column_dimensions['D'].width = 5
    ws.column_dimensions['E'].width = 11
    ws.column_dimensions['F'].width = 40
    ws.column_dimensions['G'].width = 30
    ws.column_dimensions['H'].width = 28
    ws.column_dimensions['I'].width = 10
    ws.column_dimensions['J'].width = 12
    ws.column_dimensions['K'].width = 12
    ws.column_dimensions['L'].width = 8
    ws.column_dimensions['M'].width = 45
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f"A1:M{row_num - 1}"
    
    # Sheet 2: Summary per file
    ws2 = wb.create_sheet("Summary by File")
    
    headers2 = ['File', 'Scenario', 'Tool', 'Critical', 'Error', 'Warning', 'Info', 'Total']
    for col, h in enumerate(headers2, 1):
        cell = ws2.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin_border
    
    row_num = 2
    for filename, findings in sorted(all_results.items()):
        name_lower = filename.lower().replace('.json', '')
        
        scenario = 'Unknown'
        tool = 'Unknown'
        for sn, sname in SCENARIOS.items():
            if str(sn) in name_lower:
                scenario = f"S{sn}: {sname}"
                break
        for t in TOOLS:
            if t in name_lower:
                tool = t.capitalize()
                break
        
        counts = {'CRITICAL': 0, 'ERROR': 0, 'WARNING': 0, 'INFO': 0}
        for f in findings:
            sev = f['severity']
            if sev in counts:
                counts[sev] += 1
        
        total = sum(counts.values())
        data = [filename, scenario, tool, counts['CRITICAL'], counts['ERROR'], 
                counts['WARNING'], counts['INFO'], total]
        
        for col, val in enumerate(data, 1):
            cell = ws2.cell(row=row_num, column=col, value=val)
            cell.font = normal_font
            cell.border = thin_border
            cell.alignment = Alignment(horizontal='center' if col > 2 else 'left')
        
        row_num += 1
    
    ws2.column_dimensions['A'].width = 30
    ws2.column_dimensions['B'].width = 28
    ws2.column_dimensions['C'].width = 12
    for c in 'DEFGH':
        ws2.column_dimensions[c].width = 10
    ws2.freeze_panes = 'A2'
    
    # Sheet 3: Comparison by Scenario
    ws3 = wb.create_sheet("Comparison by Scenario")
    
    headers3 = ['Scenario']
    for t in TOOLS:
        headers3.extend([f'{t.capitalize()} Critical', f'{t.capitalize()} Warning', 
                        f'{t.capitalize()} Info', f'{t.capitalize()} Total'])
    
    for col, h in enumerate(headers3, 1):
        cell = ws3.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', wrap_text=True)
        cell.border = thin_border
    
    ws3.column_dimensions['A'].width = 30
    for i in range(2, len(headers3) + 1):
        ws3.column_dimensions[chr(64 + i) if i <= 26 else 'A'].width = 12
    
    ws3.freeze_panes = 'A2'
    
    # Sheet 4: OWASP Distribution
    ws4 = wb.create_sheet("OWASP Distribution")
    
    owasp_counts = {}
    for filename, findings in all_results.items():
        name_lower = filename.lower()
        tool = 'Unknown'
        for t in TOOLS:
            if t in name_lower:
                tool = t.capitalize()
                break
        
        for f in findings:
            owasp = f['owasp']
            if owasp not in owasp_counts:
                owasp_counts[owasp] = {}
            if tool not in owasp_counts[owasp]:
                owasp_counts[owasp][tool] = 0
            owasp_counts[owasp][tool] += 1
    
    headers4 = ['OWASP Category', 'Deepseek', 'Chatgpt', 'Claude', 'Total']
    for col, h in enumerate(headers4, 1):
        cell = ws4.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin_border
    
    row_num = 2
    for owasp, tools in sorted(owasp_counts.items()):
        ds = tools.get('Deepseek', 0)
        cg = tools.get('Chatgpt', 0)
        cl = tools.get('Claude', 0)
        total = ds + cg + cl
        
        for col, val in enumerate([owasp, ds, cg, cl, total], 1):
            cell = ws4.cell(row=row_num, column=col, value=val)
            cell.font = normal_font
            cell.border = thin_border
            cell.alignment = Alignment(horizontal='center' if col > 1 else 'left')
        row_num += 1
    
    ws4.column_dimensions['A'].width = 40
    for c in 'BCDE':
        ws4.column_dimensions[c].width = 12
    ws4.freeze_panes = 'A2'
    
    return wb


def main():
    json_files = find_json_files()
    
    if not json_files:
        print("No JSON files found in current directory.")
        print("Expected naming: scenario1_deepseek.json, scenario1_chatgpt.json, etc.")
        print("Or any .json files with Semgrep output.")
        sys.exit(1)
    
    print(f"Found {len(json_files)} JSON file(s):")
    
    all_results = {}
    total_findings = 0
    
    for display_name, filepath in sorted(json_files.items()):
        try:
            findings = parse_semgrep_json(filepath)
            all_results[display_name] = findings
            total_findings += len(findings)
            print(f"  {display_name}: {len(findings)} findings")
        except Exception as e:
            print(f"  {display_name}: ERROR - {e}")
    
    if not all_results:
        print("No valid results found.")
        sys.exit(1)
    
    wb = create_excel(all_results)
    output = 'semgrep_results.xlsx'
    wb.save(output)
    
    print(f"\nTotal: {total_findings} findings across {len(all_results)} files")
    print(f"Saved to: {output}")


if __name__ == '__main__':
    main()