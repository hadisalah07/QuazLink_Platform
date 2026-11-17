package com.quazcode.quazhome.tv.ui.view

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import kotlin.random.Random

/**
 * StarFieldView: Ultra-lightweight, hardware-accelerated constellation particle
 * background matching the QuazLink web platform (StarField + NebulaBackground).
 *
 * Designed with Zero GC Allocations inside onDraw to deliver buttery-smooth 60+ FPS
 * on Android TV and TV boxes (Amlogic, MediaTek, Realtek).
 */
class StarFieldView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    companion object {
        private const val PARTICLE_COUNT = 38
        private const val MAX_DISTANCE_DP = 140f
    }

    private val density = resources.displayMetrics.density
    private val maxDistancePx = MAX_DISTANCE_DP * density
    private val maxDistSq = maxDistancePx * maxDistancePx

    // Pre-allocated particle data arrays
    private val posX = FloatArray(PARTICLE_COUNT)
    private val posY = FloatArray(PARTICLE_COUNT)
    private val velX = FloatArray(PARTICLE_COUNT)
    private val velY = FloatArray(PARTICLE_COUNT)
    private val radius = FloatArray(PARTICLE_COUNT)
    private val colorArray = IntArray(PARTICLE_COUNT)

    // Pre-allocated line coordinate buffer (x1, y1, x2, y2 for each line)
    private val maxLines = (PARTICLE_COUNT * (PARTICLE_COUNT - 1)) / 2
    private val linesBuffer = FloatArray(maxLines * 4)

    // Paint instances
    private val bgPaint = Paint().apply {
        color = Color.parseColor("#060913") // Dark deep navy space
        style = Paint.Style.FILL
    }

    private val nebulaCyanPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val nebulaPurplePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val nebulaEmeraldPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        // rgba(139, 92, 246, 0.16) in ARGB hex -> 0x298B5CF6
        color = Color.argb(42, 139, 92, 246)
        strokeWidth = 1.0f * density
        style = Paint.Style.STROKE
    }

    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val palette = intArrayOf(
        Color.parseColor("#22D3EE"), // Cyan
        Color.parseColor("#818CF8"), // Indigo
        Color.parseColor("#A78BFA"), // Purple
        Color.parseColor("#38BDF8")  // Sky
    )

    private var initialized = false
    private var lastFrameNanos = 0L
    private var isAnimating = false

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w <= 0 || h <= 0) return

        // 1. Setup Nebula Gradient Shaders
        val wF = w.toFloat()
        val hF = h.toFloat()

        // Top-left Cyan Glow (circle at 15% 15%)
        nebulaCyanPaint.shader = RadialGradient(
            wF * 0.15f, hF * 0.15f,
            wF * 0.45f,
            intArrayOf(
                Color.argb(32, 34, 211, 238),
                Color.argb(8, 34, 211, 238),
                Color.TRANSPARENT
            ),
            floatArrayOf(0f, 0.4f, 1f),
            Shader.TileMode.CLAMP
        )

        // Mid-right Purple Glow (circle at 85% 65%)
        nebulaPurplePaint.shader = RadialGradient(
            wF * 0.85f, hF * 0.65f,
            wF * 0.50f,
            intArrayOf(
                Color.argb(36, 139, 92, 246),
                Color.argb(8, 139, 92, 246),
                Color.TRANSPARENT
            ),
            floatArrayOf(0f, 0.45f, 1f),
            Shader.TileMode.CLAMP
        )

        // Bottom-center Emerald Glow (circle at 50% 90%)
        nebulaEmeraldPaint.shader = RadialGradient(
            wF * 0.50f, hF * 0.90f,
            wF * 0.35f,
            intArrayOf(
                Color.argb(20, 16, 185, 129),
                Color.TRANSPARENT
            ),
            floatArrayOf(0f, 1f),
            Shader.TileMode.CLAMP
        )

        // 2. Initialize Particles with random positions across full screen
        if (!initialized) {
            for (i in 0 until PARTICLE_COUNT) {
                posX[i] = Random.nextFloat() * wF
                posY[i] = Random.nextFloat() * hF
                // Speed tuned for subtle, premium ambient motion
                velX[i] = (Random.nextFloat() - 0.5f) * 0.5f * density
                velY[i] = (Random.nextFloat() - 0.5f) * 0.5f * density
                radius[i] = (Random.nextFloat() * 1.5f + 1.5f) * density
                colorArray[i] = palette[i % palette.size]
            }
            initialized = true
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f || !initialized) return

        // Delta-time smoothing
        val now = System.nanoTime()
        val dt = if (lastFrameNanos > 0L) {
            val elapsed = (now - lastFrameNanos) / 1_000_000_000f
            elapsed.coerceIn(0.001f, 0.05f)
        } else {
            0.016f // Default 60 FPS delta
        }
        lastFrameNanos = now
        val speedMult = dt * 60f

        // 1. Draw Background & Nebula Meshes
        canvas.drawRect(0f, 0f, w, h, bgPaint)
        canvas.drawRect(0f, 0f, w, h, nebulaCyanPaint)
        canvas.drawRect(0f, 0f, w, h, nebulaPurplePaint)
        canvas.drawRect(0f, 0f, w, h, nebulaEmeraldPaint)

        // 2. Update particle positions with screen wrap
        for (i in 0 until PARTICLE_COUNT) {
            posX[i] += velX[i] * speedMult
            posY[i] += velY[i] * speedMult

            if (posX[i] < -20f) posX[i] = w + 20f
            else if (posX[i] > w + 20f) posX[i] = -20f

            if (posY[i] < -20f) posY[i] = h + 20f
            else if (posY[i] > h + 20f) posY[i] = -20f
        }

        // 3. Batch Build Constellation Lines
        var lineCoordIdx = 0
        for (i in 0 until PARTICLE_COUNT) {
            val xi = posX[i]
            val yi = posY[i]
            for (j in (i + 1) until PARTICLE_COUNT) {
                val dx = xi - posX[j]
                val dy = yi - posY[j]
                val distSq = dx * dx + dy * dy
                if (distSq < maxDistSq) {
                    linesBuffer[lineCoordIdx++] = xi
                    linesBuffer[lineCoordIdx++] = yi
                    linesBuffer[lineCoordIdx++] = posX[j]
                    linesBuffer[lineCoordIdx++] = posY[j]
                }
            }
        }

        // Single GPU draw call for all constellation lines!
        if (lineCoordIdx > 0) {
            canvas.drawLines(linesBuffer, 0, lineCoordIdx, linePaint)
        }

        // 4. Draw Particle Dots
        for (i in 0 until PARTICLE_COUNT) {
            dotPaint.color = colorArray[i]
            dotPaint.alpha = 150 // 0.59 opacity for glowing look
            canvas.drawCircle(posX[i], posY[i], radius[i], dotPaint)
        }

        // Continuous 60 FPS animation loop
        if (isAnimating) {
            postInvalidateOnAnimation()
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        isAnimating = true
        lastFrameNanos = 0L
        postInvalidateOnAnimation()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        isAnimating = false
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        isAnimating = (visibility == VISIBLE)
        if (isAnimating) {
            lastFrameNanos = 0L
            postInvalidateOnAnimation()
        }
    }
}
