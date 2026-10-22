param(
    [string]$SetupProcessName = "QuazLink-POS-Setup",
    [string]$TargetExe = "",
    [string]$Version = "v1.3.7"
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="QuazLink POS &amp; ERP Updater"
        Width="520" Height="260"
        WindowStartupLocation="CenterScreen"
        AllowsTransparency="True"
        WindowStyle="None"
        Background="Transparent"
        Topmost="True"
        ShowInTaskbar="True">
    <Window.Resources>
        <Style TargetType="TextBlock">
            <Setter Property="FontFamily" Value="Segoe UI, Tahoma, Arial"/>
        </Style>
    </Window.Resources>
    <Border Background="#090D16" CornerRadius="18" BorderThickness="1.5" Padding="28">
        <Border.BorderBrush>
            <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                <GradientStop Color="#38BDF8" Offset="0.0"/>
                <GradientStop Color="#10B981" Offset="1.0"/>
            </LinearGradientBrush>
        </Border.BorderBrush>
        <Border.Effect>
            <DropShadowEffect Color="#38BDF8" BlurRadius="30" ShadowDepth="0" Opacity="0.35"/>
        </Border.Effect>
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
            </Grid.RowDefinitions>

            <!-- Brand Header -->
            <StackPanel Grid.Row="0" Orientation="Horizontal" HorizontalAlignment="Center" Margin="0,0,0,12">
                <TextBlock Text="⚡" FontSize="20" Foreground="#38BDF8" Margin="0,0,8,0" VerticalAlignment="Center"/>
                <TextBlock Text="QuazLink POS &amp; ERP" FontSize="20" FontWeight="Bold" Foreground="#F8FAFC" VerticalAlignment="Center"/>
                <Border Background="#1E293B" CornerRadius="8" Padding="8,2" Margin="10,0,0,0" VerticalAlignment="Center">
                    <TextBlock Name="VersionText" Text="$Version" FontSize="11" FontWeight="SemiBold" Foreground="#38BDF8"/>
                </Border>
            </StackPanel>

            <!-- Status Title -->
            <TextBlock Name="StatusTitle" Grid.Row="1" Text="جاري تثبيت التحديث الجديد بنجاح..."
                       FontSize="15" FontWeight="SemiBold" Foreground="#E2E8F0"
                       HorizontalAlignment="Center" Margin="0,0,0,6"/>

            <!-- Subtitle -->
            <TextBlock Name="StatusSubtitle" Grid.Row="2" Text="يرجى الانتظار ثوانٍ معدودة، جاري استبدال وتجهيز ملفات النظام تلقائياً."
                       FontSize="12" Foreground="#94A3B8"
                       HorizontalAlignment="Center" Margin="0,0,0,16"/>

            <!-- Progress Bar -->
            <Border Grid.Row="3" Background="#1E293B" CornerRadius="6" Height="10" Margin="10,0,10,14">
                <ProgressBar Name="ProgressBar" IsIndeterminate="True" Height="10" Background="Transparent" BorderThickness="0" Foreground="#10B981"/>
            </Border>

            <!-- Footer Note -->
            <TextBlock Grid.Row="4" Text="🔒 آمن ومحمي 100% — سيفتح البرنامج تلقائياً فور اكتمال التثبيت"
                       FontSize="11" Foreground="#64748B"
                       HorizontalAlignment="Center" VerticalAlignment="Bottom"/>
        </Grid>
    </Border>
</Window>
"@

$reader = (New-Object System.Xml.XmlNodeReader $xaml)
$window = [System.Windows.Markup.XamlReader]::Load($reader)

$statusTitle = $window.FindName("StatusTitle")
$statusSubtitle = $window.FindName("StatusSubtitle")
$progressBar = $window.FindName("ProgressBar")

# Background worker timer to monitor setup process
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(800)
$script:elapsedSeconds = 0

$timer.Add_Tick({
    $script:elapsedSeconds += 0.8
    $proc = Get-Process -Name $SetupProcessName -ErrorAction SilentlyContinue

    # If setup process exited or 90s elapsed
    if (-not $proc -or $script:elapsedSeconds -gt 90) {
        $timer.Stop()
        $statusTitle.Text = "✅ اكتمل التثبيت! جاري تشغيل البرنامج..."
        $statusTitle.Foreground = [System.Windows.Media.Brushes]::LightGreen
        $statusSubtitle.Text = "لحظات ويفتح نظام الكاشير تلقائياً."
        $progressBar.IsIndeterminate = $false
        $progressBar.Value = 100
        
        # Start application if not already running
        Start-Sleep -Seconds 1
        if ($TargetExe -and (Test-Path $TargetExe)) {
            $running = Get-Process -Name "QuazLink POS*" -ErrorAction SilentlyContinue
            if (-not $running) {
                Start-Process -FilePath $TargetExe
            }
        }
        Start-Sleep -Seconds 1
        $window.Close()
    }
})

$timer.Start()
$window.ShowDialog() | Out-Null
