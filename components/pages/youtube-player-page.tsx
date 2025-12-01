"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AICommandCallbacks } from "@/components/app-layout"

interface SavedVideo {
  id: string
  videoId: string
  title: string
  thumbnail: string
}

interface YouTubePlayerPageProps {
  commandCallbacks?: React.MutableRefObject<AICommandCallbacks>
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export function YouTubePlayerPage({ commandCallbacks }: YouTubePlayerPageProps) {
  const [videoUrl, setVideoUrl] = useState("")
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [hideVideo, setHideVideo] = useState(false)
  const [currentTitle, setCurrentTitle] = useState("Nenhuma faixa selecionada")
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem("youtube-playlist")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSavedVideos(parsed)
      } catch (error) {
        console.error("Failed to load playlist from localStorage", error)
      }
    }
  }, [])

  useEffect(() => {
    if (savedVideos.length > 0) {
      localStorage.setItem("youtube-playlist", JSON.stringify(savedVideos))
    } else {
      localStorage.removeItem("youtube-playlist")
    }
  }, [savedVideos])

  const fetchVideoTitle = async (videoId: string): Promise<string> => {
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      const data = await response.json()
      return data.title || `Video ${videoId}`
    } catch (error) {
      return `Video ${videoId}`
    }
  }

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }

    window.onYouTubeIframeAPIReady = () => {
      if (currentVideoId && playerContainerRef.current) {
        initPlayer(currentVideoId)
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
  }, [])

  const initPlayer = (videoId: string) => {
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId)
      return
    }

    if (window.YT && window.YT.Player) {
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo()
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true)
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false)
            } else if (event.data === window.YT.PlayerState.ENDED) {
              handleNext()
            }
          },
        },
      })
    }
  }

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }

    return null
  }

  useEffect(() => {
    const handlePlayVideo = async (e: Event) => {
      const customEvent = e as CustomEvent
      const url = customEvent.detail?.url
      if (url) {
        const videoId = extractVideoId(url)
        if (videoId) {
          const title = await fetchVideoTitle(videoId)
          setCurrentVideoId(videoId)
          setCurrentTitle(title)
          if (window.YT && window.YT.Player) {
            initPlayer(videoId)
          }
        }
      }
    }

    window.addEventListener("play-youtube-video", handlePlayVideo)
    return () => window.removeEventListener("play-youtube-video", handlePlayVideo)
  }, [])

  useEffect(() => {
    if (currentVideoId && window.YT && window.YT.Player) {
      initPlayer(currentVideoId)
    }
  }, [currentVideoId])

  const addVideo = async () => {
    const videoId = extractVideoId(videoUrl)
    if (videoId) {
      const title = await fetchVideoTitle(videoId)
      const video: SavedVideo = {
        id: Date.now().toString(),
        videoId,
        title,
        thumbnail: `https://img.youtube.com/vi/${videoId}/default.jpg`,
      }

      setSavedVideos([...savedVideos, video])

      if (!currentVideoId) {
        setCurrentVideoId(videoId)
        setCurrentTitle(title)
      }

      setVideoUrl("")
    }
  }

  const loadSavedVideo = (video: SavedVideo) => {
    setCurrentVideoId(video.videoId)
    setCurrentTitle(video.title)
  }

  const deleteSavedVideo = (id: string) => {
    const videoToDelete = savedVideos.find((v) => v.id === id)
    setSavedVideos(savedVideos.filter((v) => v.id !== id))

    if (videoToDelete && videoToDelete.videoId === currentVideoId) {
      setCurrentVideoId(null)
      setCurrentTitle("Nenhuma faixa selecionada")
      if (playerRef.current) {
        playerRef.current.stopVideo()
      }
      setIsPlaying(false)
    }
  }

  const resetPlaylist = () => {
    setSavedVideos([])
    setCurrentVideoId(null)
    setCurrentTitle("Nenhuma faixa selecionada")
    if (playerRef.current) {
      playerRef.current.stopVideo()
    }
    setIsPlaying(false)
  }

  const togglePlay = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo()
      } else {
        playerRef.current.playVideo()
      }
    }
  }

  const handlePrevious = () => {
    if (savedVideos.length === 0) return
    const currentIndex = savedVideos.findIndex((v) => v.videoId === currentVideoId)
    const prevIndex = currentIndex <= 0 ? savedVideos.length - 1 : currentIndex - 1
    loadSavedVideo(savedVideos[prevIndex])
  }

  const handleNext = () => {
    if (savedVideos.length === 0) return
    const currentIndex = savedVideos.findIndex((v) => v.videoId === currentVideoId)
    const nextIndex = (currentIndex + 1) % savedVideos.length
    loadSavedVideo(savedVideos[nextIndex])
  }

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute()
      } else {
        playerRef.current.mute()
      }
      setIsMuted(!isMuted)
    }
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="w-full bg-card border-b border-border overflow-hidden">
        {/* Video Player Area */}
        <div className="relative w-full" style={{ paddingTop: "56.25%" }} ref={playerContainerRef}>
          {/* YouTube iFrame */}
          {currentVideoId && !hideVideo && (
            <div className="absolute inset-0 w-full h-full">
              <div id="youtube-player" className="w-full h-full" />
            </div>
          )}

          {/* Video Hidden State */}
          {hideVideo && currentVideoId && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <p className="text-gray-400 text-sm">Vídeo oculto</p>
            </div>
          )}

          {/* Empty State */}
          {!currentVideoId && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <p className="text-gray-500 text-sm px-4 text-center">
                Nenhum vídeo na sua playlist. Adicione um vídeo do YouTube para começar.
              </p>
            </div>
          )}
        </div>

        {/* Control Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-card border-t border-border">
          {/* Previous */}
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePrevious}
            disabled={savedVideos.length === 0}
            className="h-7 w-7 text-foreground hover:bg-accent disabled:opacity-30"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>

          {/* Play/Pause */}
          <Button
            size="icon"
            onClick={togglePlay}
            disabled={!currentVideoId}
            className="h-9 w-9 rounded-md bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:bg-gray-700"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </Button>

          {/* Next */}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleNext}
            disabled={savedVideos.length === 0}
            className="h-7 w-7 text-foreground hover:bg-accent disabled:opacity-30"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>

          {/* Mute/Unmute */}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            disabled={!currentVideoId}
            className="h-7 w-7 text-foreground hover:bg-accent disabled:opacity-30"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>

          {/* Current Title */}
          <div className="flex-1 px-1 min-w-0">
            <p className="text-xs text-foreground truncate">{currentTitle}</p>
          </div>

          {/* Close/Hide Video Toggle */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setHideVideo(!hideVideo)}
            disabled={!currentVideoId}
            className="h-7 w-7 text-foreground hover:bg-accent disabled:opacity-30"
          >
            <X className="h-3.5 w-3.5" />
          </Button>

          {/* Show/Hide Video Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHideVideo(!hideVideo)}
            disabled={!currentVideoId}
            className="text-xs text-foreground hover:bg-accent disabled:opacity-30 h-7 px-2"
          >
            {hideVideo ? "Mostrar Vídeo" : "Ocultar Vídeo"}
          </Button>
        </div>

        {/* Playlist Section */}
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Playlist</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetPlaylist}
              className="h-6 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Resetar Tudo
            </Button>
          </div>

          {/* Add Video Input */}
          <div className="flex gap-2 mb-2">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addVideo()}
              placeholder="Digite a URL do YouTube ou ID do vídeo"
              className="flex-1 bg-muted border-0 text-xs h-8"
            />
            <Button size="sm" onClick={addVideo} className="bg-gray-600 hover:bg-gray-700 text-white h-8 px-3 text-xs">
              Adicionar
            </Button>
          </div>

          {/* Video List */}
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {savedVideos.map((video, index) => (
              <div
                key={video.id}
                className={`group flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors ${currentVideoId === video.videoId ? "bg-primary/20" : "bg-muted hover:bg-muted/80"
                  }`}
                onClick={() => currentVideoId !== video.videoId && loadSavedVideo(video)}
              >
                {/* Index */}
                <span className="text-xs text-muted-foreground w-3 text-center flex-shrink-0">{index + 1}</span>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{video.title}</p>
                </div>

                {/* Direct Trash2 Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSavedVideo(video.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
