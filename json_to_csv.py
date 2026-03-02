import json
import csv
import os

def export_all_remaining_tables(json_filename):
    # Faayila JSON dubbisuu
    try:
        with open(json_filename, 'r', encoding='utf-8') as file:
            data = json.load(file)
    except Exception as e:
        print(f"Dogoggora: {e}")
        return

    # Folder CSV-n itti galu
    output_folder = "csv_all_tables"
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    # Taabuluuwwan JSON keessa jiran hunda addaan baasuu
    # Metadata keessaa ykn keys deetaa keessaa ni fudhanna
    all_tables = data.get('metadata', {}).get('tables', data.keys())

    print(f"--- Adeemsa Export Jalqabaa Jira ---")

    for table_name in all_tables:
        # 'metadata' kuta deetaa waan hin taaneef bira darbuu
        if table_name == 'metadata':
            continue

        table_data = data.get(table_name, [])
        
        if not table_data:
            print(f"⚠️ {table_name}: Deetaa hin qabu, bira darbeera.")
            continue

        csv_file_path = os.path.join(output_folder, f"{table_name}.csv")
        
        # Headers (Maqaa kolomii) fudhachuu
        headers = table_data[0].keys()

        with open(csv_file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()

            for row in table_data:
                clean_row = {}
                for k, v in row.items():
                    # Boolean (True/False) gara 1/0 tti jijjiiru
                    if isinstance(v, bool):
                        clean_row[k] = 1 if v else 0
                    # JSON (Dictionary/List) yoo ta'e gara barreeffamaatti jijjiiru
                    elif isinstance(v, (dict, list)):
                        clean_row[k] = json.dumps(v)
                    # Null yoo ta'e duwwaa gochuu
                    elif v is None:
                        clean_row[k] = ""
                    else:
                        clean_row[k] = v
                writer.writerow(clean_row)
        
        print(f"✅ {table_name}.csv qophaa'eera.")

    print(f"\n--- Xumurameera! Faayilota hunda folder '{output_folder}' keessatti argattu. ---")

if __name__ == "__main__":
    # Maqaa faayila keetii asirratti sirreessi
    export_all_remaining_tables('school_backup_2026-02-26_18-35.json')