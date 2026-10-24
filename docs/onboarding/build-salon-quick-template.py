from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import sys

# Короткая анкета первичной настройки салона: только то, без чего салон не начнёт записывать клиентов.
OUT = sys.argv[1]
wb = Workbook()
HEAD = PatternFill('solid', fgColor='1F2A44')
EX = Font(italic=True, color='808080')
thin = Side(style='thin', color='D0D5DD')
B = Border(left=thin, right=thin, top=thin, bottom=thin)


def table(ws, title, cols, example, rows, dv=None):
    ws.title = title
    for i, (name, width) in enumerate(cols, 1):
        c = ws.cell(row=1, column=i, value=name)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = HEAD
        c.alignment = Alignment(wrap_text=True, vertical='center')
        c.border = B
        ws.column_dimensions[get_column_letter(i)].width = width
        e = ws.cell(row=2, column=i, value=example[i - 1])
        e.font = EX
        e.border = B
        for r in range(3, 3 + rows):
            ws.cell(row=r, column=i).border = B
    ws.row_dimensions[1].height = 32
    ws.freeze_panes = 'A3'
    for col, values in (dv or {}).items():
        v = DataValidation(type='list', formula1='"' + ','.join(values) + '"', allow_blank=True)
        ws.add_data_validation(v)
        v.add(f'{col}3:{col}{2 + rows}')


s = wb.active
s.title = 'Салон'
s['A1'] = 'Первичная настройка салона в WETOP. Серые строки: примеры, их можно стереть.'
s['A1'].font = Font(bold=True, size=12)
s.merge_cells('A1:C1')
for i, h in enumerate(['Вопрос', 'Ответ', 'Пример'], 1):
    c = s.cell(row=2, column=i, value=h)
    c.font = Font(bold=True, color='FFFFFF')
    c.fill = HEAD
qa = [
    ('Название салона', 'Alma Beauty'),
    ('Город и адрес', 'Алматы, пр. Абая 10, 2 этаж'),
    ('Телефон салона для клиентов', '+7 700 000 00 00'),
    ('Часы работы', 'Пн–Сб 10:00–21:00, Вс 11:00–19:00'),
    ('Способы оплаты', 'наличные, Kaspi, терминал'),
    ('Администратор-кассир: ФИО', 'Ахметова Дана'),
    ('Администратор-кассир: почта для входа', 'dana@example.kz'),
    ('Администратор может возвращать деньги клиенту?', 'нет'),
]
for i, (q, ex) in enumerate(qa, 3):
    s.cell(row=i, column=1, value=q).border = B
    s.cell(row=i, column=2).border = B
    e = s.cell(row=i, column=3, value=ex)
    e.font = EX
    e.border = B
s.column_dimensions['A'].width = 46
s.column_dimensions['B'].width = 40
s.column_dimensions['C'].width = 36

table(wb.create_sheet(), 'Мастера',
      [('ФИО', 30), ('Почта для входа (если есть)', 28), ('Телефон', 18), ('Какие услуги делает', 40), ('Дни и часы работы', 30)],
      ['Садыкова Айгерим', 'aigerim@example.kz', '+7 702 000 00 00', 'стрижка, окрашивание, укладка', 'Пн, Ср, Пт 10:00–19:00'],
      20)

table(wb.create_sheet(), 'Услуги',
      [('Категория', 20), ('Услуга', 34), ('Длительность, мин', 14), ('Цена', 12)],
      ['Волосы', 'Женская стрижка', 60, 8000],
      60)

table(wb.create_sheet(), 'Доп. услуги',
      [('Что', 30), ('Бесплатно или за деньги', 18), ('Цена', 12)],
      ['Кофе', 'бесплатно', ''],
      15, dv={'B': ['бесплатно', 'за деньги']})

wb.save(OUT)
print('saved', OUT)
