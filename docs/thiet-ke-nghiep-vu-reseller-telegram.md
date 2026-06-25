# Thiet ke nghiep vu reseller Telegram

Tai lieu nay mo ta thiet ke database moi cho AI Store theo huong ban goi dich vu so, trong do moi goi co the duoc giao tu kho noi bo hoac thong qua nha cung cap ben thu ba.

## Nguyen tac thiet ke

- Admin tu quan ly cay catalog: `loai_san_pham` -> `san_pham` -> `goi_dich_vu`.
- `goi_dich_vu` la don vi ban hang that su. Gia, bao hanh, ton hien thi va kha nang mua nam o cap goi.
- Moi goi co the duoc gan mot hoac nhieu `phuong_thuc_giao_hang` thong qua bang `goi_phuong_thuc_giao_hang`.
- He thong khong hard-code Canva, ChatGPT, Claude, Cursor... Cac ten nay chi la du lieu admin tao trong DB.
- Nha cung cap la actor rieng, co `telegram_id` de bot co the gui viec, nhan ket qua va thong bao.
- Cac truong JSON chi dung cho cau hinh linh hoat, form schema, du lieu khach nhap, payload giao hang. Cac truong dieu phoi chinh van la cot rieng de de query va scale.

## Catalog

- `loai_san_pham`: nhom lon nhu Design, Code, AI, Marketing.
- `san_pham`: san pham trong nhom nhu ChatGPT, Canva, Figma, Claude.
- `goi_dich_vu`: goi cu the nhu ChatGPT Plus, ChatGPT Business, Canva Edu, Canva Pro.

Vi du:

| loai_san_pham | san_pham | goi_dich_vu |
| --- | --- | --- |
| Design | Canva | Canva Edu |
| Design | Canva | Canva Pro |
| AI | ChatGPT | ChatGPT Plus |
| AI | ChatGPT | ChatGPT Business |
| Code | Cursor | Cursor Pro |

## Phuong thuc giao hang

`phuong_thuc_giao_hang.kieu` hien co 4 kieu nen dung lam primitive:

- `GUI_LINK`: he thong giao link/tai nguyen co san. Phu hop voi goi nhu Canva Edu link, Google Add Team.
- `FORM_DOI_TAC`: he thong tao yeu cau cho nha cung cap, doi tac nhap ket qua vao form, bot/gui he thong tra lai cho khach.
- `GUI_EMAIL_CHO_DOI_TAC`: khach nhap Gmail/email/workspace, he thong gui du lieu cho doi tac de add vao dich vu.
- `NHAP_TAY`: admin xu ly thu cong khi chua muon tu dong hoa.

Admin quyet dinh goi nao dung kieu nao bang `goi_phuong_thuc_giao_hang`, khong phu thuoc vao ten san pham.

## Nha cung cap Telegram

Luon tao `lien_ket_nha_cung_cap` truoc khi moi doi tac. Link nay co `ma_token`.

Flow ket noi:

1. Admin tao link moi doi tac.
2. Doi tac mo link trong Telegram Mini App hoac qua bot deep link.
3. Backend xac thuc Telegram initData/start payload, lay `telegram_id`.
4. He thong tao/cap nhat `nguoi_dung`, tao/cap nhat `nha_cung_cap`, gan `telegram_id`, danh dau link `DA_SU_DUNG`.
5. Tu luc do bot co the gui yeu cau den dung doi tac.

Bang lien quan:

- `nha_cung_cap`: ho so doi tac, trang thai hop tac, kenh nhan viec.
- `lien_ket_nha_cung_cap`: link moi rieng, token, han dung, telegram da gan.
- `nha_cung_cap_goi_dich_vu`: doi tac nao co the xu ly goi nao, voi phuong thuc nao, gia von va nang luc bao nhieu.

## Luong mua hang

1. Khach chon `goi_dich_vu`.
2. Backend chon `goi_phuong_thuc_giao_hang` mac dinh hoac theo cau hinh admin.
3. Tao `don_hang`, `chi_tiet_don_hang`, `thanh_toan`.
4. Sau khi thanh toan thanh cong:
   - Neu `GUI_LINK`: giu/ban `tai_nguyen_giao_hang`, tao `giao_hang`, gui cho khach.
   - Neu `FORM_DOI_TAC`: tao `yeu_cau_nha_cung_cap`, gui link/form cho doi tac, doi tac tra ket qua, tao `giao_hang`.
   - Neu `GUI_EMAIL_CHO_DOI_TAC`: lay email trong `chi_tiet_don_hang.du_lieu_khach_nhap`, gui cho doi tac, doi tac xac nhan da add, tao `giao_hang`.
   - Neu `NHAP_TAY`: admin tao `giao_hang` sau khi xu ly.
5. Khi tat ca `chi_tiet_don_hang` du so luong giao, cap nhat `don_hang.trang_thai = DA_GIAO`.

## Hau mai va van hanh

- `ticket_ho_tro`: bao hanh, ho tro theo don.
- `danh_gia`: danh gia theo goi dich vu, khong chi theo san pham.
- `thong_bao`: thong bao cho khach, nha cung cap, admin.
- `audit_log`: luu thay doi quan trong nhu supplier onboard, webhook thanh toan, giao hang, ma giam gia.

## Luu y cho giai doan code tiep theo

Schema moi da thay doi toan bo ten model va field, nen backend hien tai can duoc refactor theo tung cum:

1. Auth/user/role: doi sang `NguoiDung`, `VaiTro`, `TokenDangNhapAdmin`.
2. Catalog public API: doi sang `LoaiSanPham`, `SanPham`, `GoiDichVu`, `GoiPhuongThucGiaoHang`.
3. Checkout/payment: tao `DonHang`, `ChiTietDonHang`, `ThanhToan`.
4. Fulfillment: tach service xu ly theo `KieuPhuongThucGiaoHang`.
5. Admin CRUD: rebuild config entity theo ten bang/truong tieng Viet moi.
