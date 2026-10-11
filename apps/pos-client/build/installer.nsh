; ==========================================================================
; QuazLink Enterprise POS & ERP - Custom NSIS Luxury Installer Theme
; ==========================================================================

!define MUI_BGCOLOR "090D16"
!define MUI_TEXTCOLOR "F8FAFC"
!define MUI_INSTFILESPAGE_COLORS "38BDF8 090D16"
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"
!define MUI_DIRECTORYPAGE_BGCOLOR "090D16"
!define MUI_DIRECTORYPAGE_TEXTCOLOR "F8FAFC"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_TITLE_3LINES

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "QuazLink POS & ERP Setup$\r$\nمنظومة نقاط البيع وإدارة التجزئة"
  !define MUI_WELCOMEPAGE_TEXT "مرحباً بك في برنامج تثبيت QuazLink POS & ERP Enterprise.$\r$\n$\r$\n• محرك تشغيل محلي فوري (Offline-First Engine)$\r$\n• متوافق بالكامل مع أنظمة: Windows 7 SP1 / 10 / 11$\r$\n• مزامنة آلية فورية ومشفرة مع منصة وسحابة QuazLink$\r$\n$\r$\nاضغط على (التالي / Next) للمتابعة وتثبيت البرنامج على هذا الجهاز."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!define MUI_FINISHPAGE_TITLE "اكتمال تثبيت نظام QuazLink POS & ERP بنجاح"
!define MUI_FINISHPAGE_TEXT "تم تثبيت نظام QuazLink Enterprise بنجاح على هذا الحاسوب.$\r$\n$\r$\nالمنظومة مهيأة بنمط التشغيل المحلي المستقل (Offline-First) والمزامنة الفورية مع السحابة.$\r$\n$\r$\nاضغط على (إنهاء / Finish) لبدء تشغيل نظام الكاشير."
!define MUI_FINISHPAGE_RUN_TEXT "تشغيل برنامج QuazLink POS & ERP الآن (Launch Application)"
