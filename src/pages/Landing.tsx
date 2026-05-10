import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fish, Cloud, MapPin, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-fishing.jpg";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${heroImage})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/40 to-background"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            AI-Powered Fishing Advice
          </h1>
          <p className="text-base md:text-xl text-white/95 mb-5 md:mb-8 drop-shadow-md max-w-2xl mx-auto">
            Get personalized fishing recommendations powered by AI. Real-time weather, interactive
            maps, and expert advice for UK's premier fishing venues.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-primary hover:bg-white/90 shadow-medium text-base md:text-lg px-6 md:px-8"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm text-base md:text-lg px-6 md:px-8"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-8 md:mb-12 text-foreground">
            Everything You Need for a Successful Catch
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="p-4 md:p-6 hover:shadow-medium transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 md:mb-4">
                <Fish className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 text-card-foreground">AI Insights</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Claude AI analyzes fishing reports and conditions to give you personalized advice.
              </p>
            </Card>

            <Card className="p-4 md:p-6 hover:shadow-medium transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-3 md:mb-4">
                <Cloud className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 text-card-foreground">Weather Forecast</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Real-time weather data including wind, temperature, and precipitation forecasts.
              </p>
            </Card>

            <Card className="p-4 md:p-6 hover:shadow-medium transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-3 md:mb-4">
                <MapPin className="w-5 h-5 md:w-6 md:h-6 text-accent" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 text-card-foreground">Interactive Maps</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Find the best fishing spots with pins showing hot zones and entry points.
              </p>
            </Card>

            <Card className="p-4 md:p-6 hover:shadow-medium transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 md:mb-4">
                <Mail className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2 text-card-foreground">Email Delivery</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Get your complete fishing advice emailed with weather and map included.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Venues Section */}
      <section className="py-12 md:py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6 text-foreground">Featured Venues</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-5 md:mb-8">
            Get expert advice for these premier UK fishing destinations
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {["Grafham Water", "Rutland Water", "Pitsford Water", "Ravensthorpe Reservoir"].map(
              (venue) => (
                <Card key={venue} className="p-4 hover:shadow-soft transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <Fish className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-medium text-card-foreground">{venue}</span>
                  </div>
                </Card>
              )
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6 text-foreground">
            Ready to Improve Your Catch?
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-5 md:mb-8">
            Join now and get AI-powered fishing advice tailored to your chosen venue and date.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="shadow-medium text-base md:text-lg px-6 md:px-8"
          >
            Create Free Account
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Landing;
